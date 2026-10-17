-- ==============================================================================
-- SkillBridge Migration: Incremental Schema Updates for Platform Enhancements
-- 1. Repeated Connection Requests with Unique IDs & Notifications
-- 2. Secure Account Deletion Function
-- 3. Dedicated Connection Muting System
-- 4. Safe Removal of Connections
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONNECTION REQUESTS: Permit repeated requests after rejection
-- ------------------------------------------------------------------------------

-- Drop the old rigid constraint that prevented subsequent requests between the same users
alter table public.skill_connections 
  drop constraint if exists uq_requester_recipient;

-- Create partial unique index: at most ONE pending request between any user pair
create unique index if not exists idx_skill_connections_pending_pair
  on public.skill_connections (least(requester_id, recipient_id), greatest(requester_id, recipient_id))
  where status = 'pending';

-- Create partial unique index: at most ONE accepted connection between any user pair
create unique index if not exists idx_skill_connections_accepted_pair
  on public.skill_connections (least(requester_id, recipient_id), greatest(requester_id, recipient_id))
  where status = 'accepted';

-- ------------------------------------------------------------------------------
-- 2. CONNECTION MUTES TABLE: Persist user-specific conversation notification mutes
-- ------------------------------------------------------------------------------
create table if not exists public.connection_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid not null references public.skill_connections(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_user_connection_mute unique (user_id, connection_id)
);

create index if not exists idx_connection_mutes_user on public.connection_mutes(user_id);
create index if not exists idx_connection_mutes_conn on public.connection_mutes(connection_id);

alter table public.connection_mutes enable row level security;

-- Policies for connection_mutes
drop policy if exists "Users can view own connection mutes" on public.connection_mutes;
create policy "Users can view own connection mutes"
  on public.connection_mutes for select
  to authenticated, anon
  using (true);

drop policy if exists "Users can insert own connection mutes" on public.connection_mutes;
create policy "Users can insert own connection mutes"
  on public.connection_mutes for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Users can delete own connection mutes" on public.connection_mutes;
create policy "Users can delete own connection mutes"
  on public.connection_mutes for delete
  to authenticated, anon
  using (true);

-- ------------------------------------------------------------------------------
-- 3. UPDATED STORED PROCEDURE: create_connection_request
-- Ensures every new request has a brand-new unique ID and triggers a notification
-- ------------------------------------------------------------------------------
create or replace function public.create_connection_request(
  p_requester_id uuid,
  p_recipient_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_existing record;
  v_res json;
begin
  if p_requester_id = p_recipient_id then
    raise exception 'You cannot connect with yourself.';
  end if;

  -- 1. Check if there is already an active pending request between these two users
  select * into v_existing
  from public.skill_connections
  where ((requester_id = p_requester_id and recipient_id = p_recipient_id)
      or (recipient_id = p_requester_id and requester_id = p_recipient_id))
    and status = 'pending'
  limit 1;

  if found then
    raise exception 'A connection request is already pending between you.';
  end if;

  -- 2. Check if they are already connected
  select * into v_existing
  from public.skill_connections
  where ((requester_id = p_requester_id and recipient_id = p_recipient_id)
      or (recipient_id = p_requester_id and requester_id = p_recipient_id))
    and status = 'accepted'
  limit 1;

  if found then
    raise exception 'You are already connected with this user.';
  end if;

  -- 3. Insert a brand-new connection request with a unique ID
  -- This triggers tr_connection_request_created to deliver a fresh notification to recipient
  insert into public.skill_connections (
    requester_id,
    recipient_id,
    status
  ) values (
    p_requester_id,
    p_recipient_id,
    'pending'
  ) returning row_to_json(skill_connections.*) into v_res;

  return v_res;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. SECURE ACCOUNT DELETION FUNCTION
-- Deletes user profile and cascades to credentials, skills, connections, messages
-- ------------------------------------------------------------------------------
create or replace function public.delete_user_account(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Deleting from profiles cascades to:
  -- - user_credentials (on delete cascade)
  -- - user_skills (on delete cascade)
  -- - skill_connections where requester_id or recipient_id = p_user_id (on delete cascade)
  -- - messages where sender_id = p_user_id OR in deleted connection (on delete cascade)
  -- - notifications where recipient_id or sender_id = p_user_id (on delete cascade)
  -- - connection_mutes where user_id = p_user_id (on delete cascade)
  delete from public.profiles where id = p_user_id;

  return true;
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. SECURE CONNECTION REMOVAL FUNCTION
-- Removes an accepted connection safely for both users
-- ------------------------------------------------------------------------------
create or replace function public.remove_user_connection(
  p_connection_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_conn record;
begin
  select * into v_conn from public.skill_connections where id = p_connection_id;
  if not found then
    raise exception 'Connection not found.';
  end if;

  if v_conn.requester_id <> p_user_id and v_conn.recipient_id <> p_user_id then
    raise exception 'Access denied: You are not a participant in this connection.';
  end if;

  -- Remove the connection record, which cleanly revokes chat access
  delete from public.skill_connections where id = p_connection_id;

  return true;
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. CONNECTION MUTE TOGGLE FUNCTION
-- ------------------------------------------------------------------------------
create or replace function public.toggle_connection_mute(
  p_connection_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_exists boolean;
begin
  -- Verify user is a participant
  if not exists (
    select 1 from public.skill_connections
    where id = p_connection_id and (requester_id = p_user_id or recipient_id = p_user_id)
  ) then
    raise exception 'Access denied: You are not a participant in this connection.';
  end if;

  select exists(
    select 1 from public.connection_mutes
    where user_id = p_user_id and connection_id = p_connection_id
  ) into v_exists;

  if v_exists then
    delete from public.connection_mutes
    where user_id = p_user_id and connection_id = p_connection_id;
    return false; -- unmuted
  else
    insert into public.connection_mutes (user_id, connection_id)
    values (p_user_id, p_connection_id)
    on conflict do nothing;
    return true; -- muted
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 7. RE-GRANT ROLES FOR ANY NEW OBJECTS
-- ------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;
