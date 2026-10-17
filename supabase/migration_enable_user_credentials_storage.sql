-- ==============================================================================
-- SkillBridge Migration: Enable public.user_credentials storage & bypass RLS
-- ==============================================================================
-- Purpose:
-- Allows the backend (whether using the anon key or service_role key) to store,
-- update, and query bcrypt password hashes in public.user_credentials.
-- ==============================================================================

-- 1. Ensure public.user_credentials table structure is complete
create table if not exists public.user_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Disable Row Level Security on user_credentials so the server can insert & update
alter table public.user_credentials disable row level security;

-- 3. Grant full permissions to anon, authenticated, and service_role
grant all on table public.user_credentials to anon, authenticated, service_role;

-- 4. Create a SECURITY DEFINER helper function for guaranteed credential storage
create or replace function public.save_user_credential(
  p_user_id uuid,
  p_password_hash text
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_credentials (user_id, password_hash, updated_at)
  values (p_user_id, p_password_hash, now())
  on conflict (user_id)
  do update set
    password_hash = excluded.password_hash,
    updated_at = now();
end;
$$;

grant execute on function public.save_user_credential(uuid, text) to anon, authenticated, service_role;
