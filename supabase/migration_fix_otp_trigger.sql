-- ==============================================================================
-- SkillBridge Migration: Fix Supabase OTP & Prevent Premature User Creation
-- ==============================================================================
-- Problem:
-- The trigger 'on_auth_user_created' on auth.users executed handle_new_user()
-- which failed on 'digest' function resolution and attempted to prematurely insert
-- into public.profiles on Send OTP, causing Supabase Auth to reject OTP sending with:
-- "Database error saving new user" (HTTP 500).
--
-- Solution:
-- 1. Drop trigger 'on_auth_user_created' from auth.users.
-- 2. Update handle_new_user to be a safe no-op with proper search_path.
-- 3. Profile creation remains cleanly handled by the SkillBridge registration endpoint
--    only AFTER successful Gmail OTP verification.
-- ==============================================================================

-- 1. Drop trigger on auth.users
do $$
begin
  if exists (
    select 1 
    from information_schema.triggers 
    where event_object_table = 'users' 
      and trigger_name = 'on_auth_user_created'
  ) then
    drop trigger if exists on_auth_user_created on auth.users;
  end if;
exception
  when others then
    null;
end $$;

-- 2. Replace handle_new_user with safe no-op function
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return new;
end;
$$;

-- 3. Grant execute permissions
grant execute on function public.handle_new_user() to anon, authenticated, service_role;
