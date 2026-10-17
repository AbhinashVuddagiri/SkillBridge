-- ==============================================================================
-- SkillBridge Migration: Fix Delete Account RPC & Include Email in Profile Lookup
-- ==============================================================================

-- 1. Update get_profile_by_id to include verified email/gmail in return json
create or replace function public.get_profile_by_id(
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile json;
begin
  select json_build_object(
    'id', p.id,
    'name', p.full_name,
    'instituteName', p.institute_name,
    'bridgeAccount', p.bridge_account,
    'email', p.email,
    'avatar', p.avatar_url,
    'profileCompleted', p.profile_completed,
    'skillsTeach', coalesce((select json_agg(skill_name) from public.user_skills where user_id = p.id and skill_type = 'teach'), '[]'::json),
    'skillsLearn', coalesce((select json_agg(skill_name) from public.user_skills where user_id = p.id and skill_type = 'learn'), '[]'::json),
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  ) into v_profile
  from public.profiles p
  where p.id = p_user_id;

  return v_profile;
end;
$$;

-- 2. Enhanced delete_user_account function that thoroughly cleans up all user records
create or replace function public.delete_user_account(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Remove messages sent by user
  delete from public.messages where sender_id = p_user_id;

  -- 2. Remove all skill connections involving user (and cascade any remaining messages)
  delete from public.skill_connections where requester_id = p_user_id or recipient_id = p_user_id;

  -- 3. Remove all notifications involving user
  delete from public.notifications where recipient_id = p_user_id or sender_id = p_user_id;

  -- 4. Remove connection mutes
  delete from public.connection_mutes where user_id = p_user_id;

  -- 5. Remove user skills
  delete from public.user_skills where user_id = p_user_id;

  -- 6. Remove user credentials
  delete from public.user_credentials where user_id = p_user_id;

  -- 7. Remove profile record
  delete from public.profiles where id = p_user_id;

  -- 8. Remove from auth.users if permissions allow
  begin
    delete from auth.users where id = p_user_id;
  exception
    when others then
      null;
  end;

  return true;
end;
$$;

-- 3. Update permissions
grant execute on function public.get_profile_by_id(uuid) to authenticated, anon;
grant execute on function public.delete_user_account(uuid) to authenticated, anon;
