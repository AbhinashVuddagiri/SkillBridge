-- ==============================================================================
-- MIGRATION: MAKE ALL REGISTERED USERS VISIBLE IN EXPLORE SKILLS
-- ==============================================================================
-- Problem: 
-- Previously, get_explore_users required `p.profile_completed = true`.
-- Newly registered users were hidden until they explicitly updated both
-- teaching and learning skills in their profile, resulting in empty Explore pages.
--
-- Solution:
-- 1. Update RLS policy on `public.profiles` so all registered profiles are publicly readable.
-- 2. Update `get_explore_users` to return all registered users (excluding the current user),
--    prioritizing users with completed profiles first.
-- ==============================================================================

-- 1. Update RLS policy on public.profiles
drop policy if exists "Completed profiles are publicly readable" on public.profiles;
drop policy if exists "Profiles are publicly readable" on public.profiles;

create policy "Profiles are publicly readable"
  on public.profiles for select
  to authenticated, anon
  using (true);

-- 2. Enhanced get_explore_users function
create or replace function public.get_explore_users(
  p_current_user_id uuid default null,
  p_search_query text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text;
  v_users json;
begin
  v_q := lower(trim(coalesce(p_search_query, '')));

  select json_agg(user_obj) into v_users
  from (
    select json_build_object(
      'id', p.id,
      'name', p.full_name,
      'instituteName', p.institute_name,
      'bridgeAccount', p.bridge_account,
      'avatar', p.avatar_url,
      'skillsTeach', coalesce((select json_agg(skill_name) from public.user_skills where user_id = p.id and skill_type = 'teach'), '[]'::json),
      'skillsLearn', coalesce((select json_agg(skill_name) from public.user_skills where user_id = p.id and skill_type = 'learn'), '[]'::json),
      'connectionStatus', coalesce((
        select sc.status
        from public.skill_connections sc
        where p_current_user_id is not null and (
          (sc.requester_id = p_current_user_id and sc.recipient_id = p.id) or
          (sc.recipient_id = p_current_user_id and sc.requester_id = p.id)
        )
        order by
          case sc.status
            when 'accepted' then 1
            when 'pending' then 2
            when 'rejected' then 3
            else 4
          end asc,
          sc.updated_at desc,
          sc.created_at desc
        limit 1
      ), 'none'),
      'connectionId', (
        select sc.id
        from public.skill_connections sc
        where p_current_user_id is not null and (
          (sc.requester_id = p_current_user_id and sc.recipient_id = p.id) or
          (sc.recipient_id = p_current_user_id and sc.requester_id = p.id)
        )
        order by
          case sc.status
            when 'accepted' then 1
            when 'pending' then 2
            when 'rejected' then 3
            else 4
          end asc,
          sc.updated_at desc,
          sc.created_at desc
        limit 1
      ),
      'isRequester', coalesce((
        select sc.requester_id = p_current_user_id
        from public.skill_connections sc
        where p_current_user_id is not null and (
          (sc.requester_id = p_current_user_id and sc.recipient_id = p.id) or
          (sc.recipient_id = p_current_user_id and sc.requester_id = p.id)
        )
        order by
          case sc.status
            when 'accepted' then 1
            when 'pending' then 2
            when 'rejected' then 3
            else 4
          end asc,
          sc.updated_at desc,
          sc.created_at desc
        limit 1
      ), false)
    ) as user_obj
    from public.profiles p
    where (p_current_user_id is null or p.id <> p_current_user_id)
      and (
        v_q = ''
        or lower(p.full_name) like '%' || v_q || '%'
        or lower(p.institute_name) like '%' || v_q || '%'
        or lower(p.bridge_account) like '%' || v_q || '%'
        or exists (
          select 1 from public.user_skills us
          where us.user_id = p.id and lower(us.skill_name) like '%' || v_q || '%'
        )
      )
    order by 
      (case when p.profile_completed then 1 else 0 end) desc,
      p.created_at desc
  ) s;

  return coalesce(v_users, '[]'::json);
end;
$$;

-- 3. Grant execute permissions
grant execute on function public.get_explore_users(uuid, text) to authenticated, anon;
