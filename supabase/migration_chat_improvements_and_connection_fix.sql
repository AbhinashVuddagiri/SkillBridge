-- ==============================================================================
-- SkillBridge Migration: Chat Enhancements & Connection Status Logic Fix
-- 1. Add Message Features: Replies, Edits, Unsends, Per-User Deletions
-- 2. Add Clear Chat support (per-user clear timestamps & deleted_by tracking)
-- 3. Fix Connection Status Prioritization in Explore Skills (Change 2)
-- 4. Message Triggers: Honor conversation mute setting
-- 5. Stored Procedures for Chat Actions (Edit, Unsend, Delete for Me, Clear)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. MESSAGES TABLE ENHANCEMENTS
-- ------------------------------------------------------------------------------

-- Add reply reference
alter table public.messages 
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

-- Add edited flag and timestamp
alter table public.messages 
  add column if not exists is_edited boolean not null default false;

-- Add unsend flag
alter table public.messages 
  add column if not exists is_unsent boolean not null default false;

-- Add per-user deletion array (stores user IDs who deleted message from their view)
alter table public.messages 
  add column if not exists deleted_by uuid[] not null default '{}';

-- Add updated_at for edit tracking
alter table public.messages 
  add column if not exists updated_at timestamptz not null default now();

-- Indexes for efficient queries
create index if not exists idx_messages_reply_to on public.messages(reply_to_id);
create index if not exists idx_messages_is_unsent on public.messages(is_unsent);

-- ------------------------------------------------------------------------------
-- 2. SKILL_CONNECTIONS TABLE ENHANCEMENTS (Clear Chat Tracking)
-- ------------------------------------------------------------------------------

alter table public.skill_connections 
  add column if not exists requester_cleared_at timestamptz default null;

alter table public.skill_connections 
  add column if not exists recipient_cleared_at timestamptz default null;

-- Ensure connection_mutes table exists
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
-- 3. MESSAGE NOTIFICATION TRIGGER (Honor Mute Setting)
-- ------------------------------------------------------------------------------
create or replace function public.on_message_created()
returns trigger
language plpgsql
security definer
as $$
declare
  v_recipient_id uuid;
  v_sender_name text;
  v_is_muted boolean;
begin
  -- Find the recipient from the connection
  select 
    case 
      when sc.requester_id = new.sender_id then sc.recipient_id
      else sc.requester_id
    end into v_recipient_id
  from public.skill_connections sc
  where sc.id = new.connection_id;

  if v_recipient_id is not null then
    -- Check if recipient muted notifications for this conversation
    select exists(
      select 1 from public.connection_mutes
      where user_id = v_recipient_id and connection_id = new.connection_id
    ) into v_is_muted;

    -- Only send notification if NOT muted
    if not coalesce(v_is_muted, false) then
      select full_name into v_sender_name from public.profiles where id = new.sender_id;
      v_sender_name := coalesce(v_sender_name, 'Connected Partner');

      insert into public.notifications (
        recipient_id,
        sender_id,
        notification_type,
        message,
        related_connection_id
      ) values (
        v_recipient_id,
        new.sender_id,
        'new_message',
        'New message from ' || v_sender_name || ': "' || left(new.message_body, 60) || (case when length(new.message_body) > 60 then '...' else '' end) || '"',
        new.connection_id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_message_created on public.messages;
create trigger tr_message_created
  after insert on public.messages
  for each row execute function public.on_message_created();

-- ------------------------------------------------------------------------------
-- 4. GET CONNECTION MESSAGES LIST (Replies, Edits, Deletion & Clear Filters)
-- ------------------------------------------------------------------------------
create or replace function public.get_connection_messages_list(
  p_connection_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_conn record;
  v_partner_id uuid;
  v_partner json;
  v_messages json;
  v_cleared_at timestamptz;
begin
  select * into v_conn from public.skill_connections where id = p_connection_id;
  if not found then
    raise exception 'Connection not found.';
  end if;

  if v_conn.requester_id <> p_user_id and v_conn.recipient_id <> p_user_id then
    raise exception 'Access denied: You are not a participant in this connection.';
  end if;

  if v_conn.status <> 'accepted' then
    raise exception 'Chat is only accessible for accepted connections.';
  end if;

  v_partner_id := case when v_conn.requester_id = p_user_id then v_conn.recipient_id else v_conn.requester_id end;
  v_cleared_at := case when v_conn.requester_id = p_user_id then v_conn.requester_cleared_at else v_conn.recipient_cleared_at end;

  select json_build_object(
    'id', p.id,
    'name', p.full_name,
    'instituteName', p.institute_name,
    'bridgeAccount', p.bridge_account,
    'avatar', p.avatar_url
  ) into v_partner
  from public.profiles p
  where p.id = v_partner_id;

  select json_agg(msg_obj) into v_messages
  from (
    select json_build_object(
      'id', m.id,
      'connectionId', m.connection_id,
      'senderId', m.sender_id,
      'messageBody', m.message_body,
      'createdAt', m.created_at,
      'isEdited', coalesce(m.is_edited, false),
      'replyToId', m.reply_to_id,
      'replyTo', (
        case when m.reply_to_id is not null then (
          select json_build_object(
            'id', rm.id,
            'senderId', rm.sender_id,
            'senderName', rp.full_name,
            'messageBody', rm.message_body
          )
          from public.messages rm
          left join public.profiles rp on rp.id = rm.sender_id
          where rm.id = m.reply_to_id
        ) else null end
      )
    ) as msg_obj
    from public.messages m
    where m.connection_id = p_connection_id
      and (m.is_unsent is false or m.is_unsent is null)
      and not (m.deleted_by @> array[p_user_id])
      and (v_cleared_at is null or m.created_at > v_cleared_at)
    order by m.created_at asc
  ) s;

  return json_build_object(
    'connectionId', p_connection_id,
    'partner', v_partner,
    'messages', coalesce(v_messages, '[]'::json)
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. SEND CONNECTION MESSAGE (With optional reply_to_id)
-- ------------------------------------------------------------------------------
create or replace function public.send_connection_message_entry(
  p_connection_id uuid,
  p_user_id uuid,
  p_message_body text,
  p_reply_to_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_conn record;
  v_new_msg public.messages%rowtype;
  v_reply_to json := null;
begin
  if trim(p_message_body) = '' then
    raise exception 'Message cannot be empty.';
  end if;

  select * into v_conn from public.skill_connections where id = p_connection_id;
  if not found then
    raise exception 'Connection not found.';
  end if;

  if v_conn.requester_id <> p_user_id and v_conn.recipient_id <> p_user_id then
    raise exception 'Access denied: You are not a participant in this connection.';
  end if;

  if v_conn.status <> 'accepted' then
    raise exception 'Chat is only accessible for accepted connections.';
  end if;

  insert into public.messages (
    connection_id,
    sender_id,
    message_body,
    reply_to_id
  ) values (
    p_connection_id,
    p_user_id,
    trim(p_message_body),
    p_reply_to_id
  ) returning * into v_new_msg;

  if v_new_msg.reply_to_id is not null then
    select json_build_object(
      'id', rm.id,
      'senderId', rm.sender_id,
      'senderName', rp.full_name,
      'messageBody', rm.message_body
    ) into v_reply_to
    from public.messages rm
    left join public.profiles rp on rp.id = rm.sender_id
    where rm.id = v_new_msg.reply_to_id;
  end if;

  return json_build_object(
    'id', v_new_msg.id,
    'connectionId', v_new_msg.connection_id,
    'senderId', v_new_msg.sender_id,
    'messageBody', v_new_msg.message_body,
    'createdAt', v_new_msg.created_at,
    'isEdited', false,
    'replyToId', v_new_msg.reply_to_id,
    'replyTo', v_reply_to
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. EDIT MESSAGE FUNCTION (Sender only)
-- ------------------------------------------------------------------------------
create or replace function public.edit_connection_message(
  p_message_id uuid,
  p_user_id uuid,
  p_new_body text
)
returns json
language plpgsql
security definer
as $$
declare
  v_msg record;
  v_reply_to json := null;
  v_updated record;
begin
  if trim(p_new_body) = '' then
    raise exception 'Message body cannot be empty.';
  end if;

  select * into v_msg from public.messages where id = p_message_id;
  if not found then
    raise exception 'Message not found.';
  end if;

  if v_msg.sender_id <> p_user_id then
    raise exception 'Access denied: You can only edit your own messages.';
  end if;

  if coalesce(v_msg.is_unsent, false) then
    raise exception 'Cannot edit an unsent message.';
  end if;

  update public.messages
  set message_body = trim(p_new_body),
      is_edited = true,
      updated_at = now()
  where id = p_message_id
  returning * into v_updated;

  if v_updated.reply_to_id is not null then
    select json_build_object(
      'id', rm.id,
      'senderId', rm.sender_id,
      'senderName', rp.full_name,
      'messageBody', rm.message_body
    ) into v_reply_to
    from public.messages rm
    left join public.profiles rp on rp.id = rm.sender_id
    where rm.id = v_updated.reply_to_id;
  end if;

  return json_build_object(
    'id', v_updated.id,
    'connectionId', v_updated.connection_id,
    'senderId', v_updated.sender_id,
    'messageBody', v_updated.message_body,
    'createdAt', v_updated.created_at,
    'isEdited', v_updated.is_edited,
    'replyToId', v_updated.reply_to_id,
    'replyTo', v_reply_to
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 7. UNSEND MESSAGE FUNCTION (Sender only, removes for both users)
-- ------------------------------------------------------------------------------
create or replace function public.unsend_connection_message(
  p_message_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_msg record;
begin
  select * into v_msg from public.messages where id = p_message_id;
  if not found then
    raise exception 'Message not found.';
  end if;

  if v_msg.sender_id <> p_user_id then
    raise exception 'Access denied: You can only unsend your own messages.';
  end if;

  update public.messages
  set is_unsent = true,
      updated_at = now()
  where id = p_message_id;

  return true;
end;
$$;

-- ------------------------------------------------------------------------------
-- 8. DELETE FROM ME FUNCTION (Hides message from current user only)
-- ------------------------------------------------------------------------------
create or replace function public.delete_message_for_me(
  p_message_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_msg record;
  v_conn record;
begin
  select * into v_msg from public.messages where id = p_message_id;
  if not found then
    raise exception 'Message not found.';
  end if;

  select * into v_conn from public.skill_connections where id = v_msg.connection_id;
  if not found or (v_conn.requester_id <> p_user_id and v_conn.recipient_id <> p_user_id) then
    raise exception 'Access denied: You are not a participant in this conversation.';
  end if;

  update public.messages
  set deleted_by = array_append(deleted_by, p_user_id)
  where id = p_message_id
    and not (deleted_by @> array[p_user_id]);

  return true;
end;
$$;

-- ------------------------------------------------------------------------------
-- 9. CLEAR CONNECTION CHAT (Clears conversation for current user only)
-- ------------------------------------------------------------------------------
create or replace function public.clear_connection_chat(
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
    raise exception 'Access denied.';
  end if;

  -- Update per-user clear timestamp on skill_connections
  if v_conn.requester_id = p_user_id then
    update public.skill_connections
    set requester_cleared_at = now()
    where id = p_connection_id;
  else
    update public.skill_connections
    set recipient_cleared_at = now()
    where id = p_connection_id;
  end if;

  -- Add user ID to deleted_by for all existing messages in this connection
  update public.messages
  set deleted_by = array_append(deleted_by, p_user_id)
  where connection_id = p_connection_id
    and not (deleted_by @> array[p_user_id]);

  return true;
end;
$$;

-- ------------------------------------------------------------------------------
-- 10. GET EXPLORE USERS (Prioritizes accepted & pending connections over rejected)
-- Fixes Change 2: "Declined - Connect Again" remaining after acceptance
-- ------------------------------------------------------------------------------
create or replace function public.get_explore_users(
  p_current_user_id uuid default null,
  p_search_query text default null
)
returns json
language plpgsql
security definer
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
    where p.profile_completed = true
      and (p_current_user_id is null or p.id <> p_current_user_id)
      and (
        v_q = ''
        or lower(p.full_name) like '%' || v_q || '%'
        or lower(p.institute_name) like '%' || v_q || '%'
        or exists (
          select 1 from public.user_skills us
          where us.user_id = p.id and lower(us.skill_name) like '%' || v_q || '%'
        )
      )
    order by p.created_at desc
  ) s;

  return coalesce(v_users, '[]'::json);
end;
$$;

-- ------------------------------------------------------------------------------
-- 11. CLEANUP OLD REJECTED ROW ON NEW REQUEST (Ensure Single Active Request)
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

  -- 3. Delete any previous rejected records between this pair to maintain a pristine history
  delete from public.skill_connections
  where ((requester_id = p_requester_id and recipient_id = p_recipient_id)
      or (recipient_id = p_requester_id and requester_id = p_recipient_id))
    and status = 'rejected';

  -- 4. Insert fresh connection request with unique ID
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
-- 12. ROLE PERMISSIONS
-- ------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
