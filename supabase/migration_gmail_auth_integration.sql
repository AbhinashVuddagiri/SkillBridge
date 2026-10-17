-- ==============================================================================
-- SkillBridge Migration: Gmail Verification & Supabase Auth Integration
-- Preserves existing profiles, connections, chats, notifications, and data
-- Reuses existing bridge_account as unique username identifier
-- Adds verified Gmail column and synchronizes with Supabase Auth
-- ==============================================================================

-- 1. Ensure extensions exist
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Add verified email (Gmail) column to profiles table if it doesn't exist
alter table public.profiles 
add column if not exists email text;

-- 3. Case-insensitive unique index on verified email (only for non-null emails)
create unique index if not exists idx_profiles_email_lower 
on public.profiles (lower(email)) where email is not null;

-- 4. Case-insensitive unique index on bridge_account (username) if not already existing
create unique index if not exists idx_profiles_bridge_account_lower 
on public.profiles (lower(bridge_account));

-- 5. Updated handle_new_user function to automatically link Supabase Auth users to profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_gmail text;
begin
  -- Resolve username from metadata or fallback to email local-part
  v_username := coalesce(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'bridge_account',
    split_part(new.email, '@', 1)
  );

  v_gmail := new.email;

  insert into public.profiles (
    id,
    full_name,
    institute_name,
    bridge_account,
    email,
    avatar_url,
    profile_completed
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'SkillBridge Member'),
    coalesce(new.raw_user_meta_data->>'institute_name', ''),
    v_username,
    v_gmail,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/7.x/bottts/svg?seed=' || encode(digest(new.id::text, 'sha256'), 'hex')
    ),
    false
  ) on conflict (id) do update set
    bridge_account = coalesce(excluded.bridge_account, profiles.bridge_account),
    email = coalesce(excluded.email, profiles.email),
    full_name = coalesce(excluded.full_name, profiles.full_name),
    institute_name = coalesce(excluded.institute_name, profiles.institute_name),
    updated_at = now();

  return new;
end;
$$;

-- 6. Attach trigger to auth.users if permissions allow (ignored if auth schema is locked)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
exception
  when others then
    -- Suppress trigger attachment errors if running without superuser privileges
    null;
end $$;

-- 7. Ensure delete_user_account function exists for secure deletion
create or replace function public.delete_user_account(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Cascades automatically delete related user_skills, connections, messages, notifications, credentials
  delete from public.profiles where id = p_user_id;
  return true;
end;
$$;

-- 8. Add RLS policy for authenticated users to delete their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'profiles' 
      and policyname = 'Users can delete own profile'
  ) then
    create policy "Users can delete own profile"
      on public.profiles for delete
      to authenticated
      using (auth.uid() = id);
  end if;
end $$;

-- 9. Function to look up a user for login by username (case-insensitive)
create or replace function public.get_user_by_username_or_email(
  p_identifier text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
begin
  select 
    p.id,
    p.full_name as name,
    p.institute_name as "instituteName",
    p.bridge_account as "bridgeAccount",
    p.bridge_account as username,
    p.email,
    p.avatar_url as avatar,
    p.profile_completed as "profileCompleted",
    c.password_hash as "passwordHash"
  into v_rec
  from public.profiles p
  left join public.user_credentials c on c.user_id = p.id
  where lower(p.bridge_account) = lower(trim(p_identifier))
     or lower(coalesce(p.email, '')) = lower(trim(p_identifier))
  limit 1;

  if v_rec.id is null then
    return null;
  end if;

  return row_to_json(v_rec);
end;
$$;

-- 10. Grant execute permissions
grant execute on function public.handle_new_user() to authenticated, anon;
grant execute on function public.delete_user_account(uuid) to authenticated, anon;
grant execute on function public.get_user_by_username_or_email(text) to authenticated, anon;
