-- ==============================================================================
-- SkillBridge Migration: Add BridgeAccount & Enforce Case-Insensitive Uniqueness
-- Compatible with SkillBridge Core Schema
-- ==============================================================================

-- 1. Ensure uuid and pgcrypto extensions are available
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Add bridge_account column to profiles table if it doesn't exist
alter table public.profiles 
add column if not exists bridge_account text;

-- 3. Add database-level case-insensitive unique index on bridge_account
create unique index if not exists idx_profiles_bridge_account_lower 
on public.profiles (lower(bridge_account));

-- 4. Secure user credentials table for Bridge Account passwords
create table if not exists public.user_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_credentials enable row level security;

-- 5. Safe handle_new_user function that maps correctly to profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bridge text;
begin
  v_bridge := coalesce(
    new.raw_user_meta_data->>'bridge_account',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (
    id,
    full_name,
    institute_name,
    bridge_account,
    avatar_url,
    profile_completed
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Student Learner'),
    coalesce(new.raw_user_meta_data->>'institute_name', ''),
    v_bridge,
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || encode(digest(new.id::text, 'sha256'), 'hex')),
    false
  ) on conflict (id) do update set
    bridge_account = coalesce(excluded.bridge_account, profiles.bridge_account),
    full_name = coalesce(excluded.full_name, profiles.full_name),
    institute_name = coalesce(excluded.institute_name, profiles.institute_name);

  return new;
end;
$$;
