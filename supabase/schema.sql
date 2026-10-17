-- ==============================================================================
-- SkillBridge Database Schema & Row Level Security (RLS) Policies
-- Platform: SkillBridge — Share Skills. Learn Together.
-- ==============================================================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. PROFILES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  institute_name text not null default '',
  bridge_account text not null unique,
  avatar_url text default '',
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive unique index on bridge_account
create unique index if not exists idx_profiles_bridge_account_lower 
on public.profiles (lower(bridge_account));

create index if not exists idx_profiles_completed 
on public.profiles (profile_completed);

-- ------------------------------------------------------------------------------
-- 2.5 USER_CREDENTIALS TABLE (Secure password storage for Bridge Accounts)
-- ------------------------------------------------------------------------------
create table if not exists public.user_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_credentials enable row level security;
-- Notice: No public RLS policies granted on user_credentials. Only accessible via SECURITY DEFINER functions or service role.

-- ------------------------------------------------------------------------------
-- 3. USER_SKILLS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_name text not null,
  skill_type text not null check (skill_type in ('teach', 'learn')),
  created_at timestamptz not null default now(),
  constraint uq_user_skill_type unique (user_id, skill_name, skill_type)
);

create index if not exists idx_user_skills_user on public.user_skills(user_id);
create index if not exists idx_user_skills_name on public.user_skills(lower(skill_name));
create index if not exists idx_user_skills_type on public.user_skills(skill_type);

-- ------------------------------------------------------------------------------
-- 4. SKILL_CONNECTIONS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.skill_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_no_self_connection check (requester_id <> recipient_id),
  constraint uq_requester_recipient unique (requester_id, recipient_id)
);

create index if not exists idx_connections_requester on public.skill_connections(requester_id);
create index if not exists idx_connections_recipient on public.skill_connections(recipient_id);
create index if not exists idx_connections_status on public.skill_connections(status);

-- ------------------------------------------------------------------------------
-- 5. NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  notification_type text not null check (notification_type in ('connection_request', 'connection_accepted', 'connection_rejected', 'new_message')),
  message text not null,
  related_connection_id uuid references public.skill_connections(id) on delete cascade,
  read_status boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient on public.notifications(recipient_id);
create index if not exists idx_notifications_unread on public.notifications(recipient_id, read_status);

-- ------------------------------------------------------------------------------
-- 6. MESSAGES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.skill_connections(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message_body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_connection on public.messages(connection_id);
create index if not exists idx_messages_created on public.messages(created_at);

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_skills enable row level security;
alter table public.skill_connections enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;

-- Profiles:
-- Public can read completed profiles; users can always read their own profile.
create policy "Completed profiles are publicly readable"
  on public.profiles for select
  to authenticated, anon
  using (profile_completed = true or auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- User Skills:
-- Anyone can read skills of completed profiles or their own skills.
create policy "Skills are readable by all"
  on public.user_skills for select
  to authenticated, anon
  using (true);

create policy "Users can insert own skills"
  on public.user_skills for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own skills"
  on public.user_skills for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own skills"
  on public.user_skills for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Skill Connections:
-- Users can only see connections where they are requester or recipient.
create policy "Users can view their own connections"
  on public.skill_connections for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "Users can send connection requests"
  on public.skill_connections for insert
  to authenticated
  with check (auth.uid() = requester_id and requester_id <> recipient_id);

create policy "Recipients can update connection status"
  on public.skill_connections for update
  to authenticated
  using (auth.uid() = recipient_id or auth.uid() = requester_id)
  with check (auth.uid() = recipient_id or auth.uid() = requester_id);

-- Notifications:
-- Users can only read and update their own notifications.
create policy "Users can read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = recipient_id);

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Messages:
-- Messages can ONLY be viewed by participants of an ACCEPTED connection.
create policy "Participants can read messages in accepted connection"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.skill_connections sc
      where sc.id = messages.connection_id
        and sc.status = 'accepted'
        and (sc.requester_id = auth.uid() or sc.recipient_id = auth.uid())
    )
  );

create policy "Participants can send messages in accepted connection"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.skill_connections sc
      where sc.id = messages.connection_id
        and sc.status = 'accepted'
        and (sc.requester_id = auth.uid() or sc.recipient_id = auth.uid())
    )
  );

-- ------------------------------------------------------------------------------
-- 8. AUTOMATIC NOTIFICATION TRIGGERS
-- ------------------------------------------------------------------------------
-- Trigger 1: When a connection request is created, notify the recipient
create or replace function public.on_connection_request_created()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sender_name text;
begin
  select full_name into v_sender_name from public.profiles where id = new.requester_id;
  v_sender_name := coalesce(v_sender_name, 'A user');

  insert into public.notifications (
    recipient_id,
    sender_id,
    notification_type,
    message,
    related_connection_id
  ) values (
    new.recipient_id,
    new.requester_id,
    'connection_request',
    v_sender_name || ' sent you a connection request!',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists tr_connection_request_created on public.skill_connections;
create trigger tr_connection_request_created
  after insert on public.skill_connections
  for each row execute function public.on_connection_request_created();

-- Trigger 2: When connection status changes to accepted or rejected, notify requester
create or replace function public.on_connection_status_updated()
returns trigger
language plpgsql
security definer
as $$
declare
  v_recipient_name text;
begin
  if new.status <> old.status then
    select full_name into v_recipient_name from public.profiles where id = new.recipient_id;
    v_recipient_name := coalesce(v_recipient_name, 'A user');

    if new.status = 'accepted' then
      insert into public.notifications (
        recipient_id,
        sender_id,
        notification_type,
        message,
        related_connection_id
      ) values (
        new.requester_id,
        new.recipient_id,
        'connection_accepted',
        v_recipient_name || ' accepted your connection request! You can now chat.',
        new.id
      );
    elsif new.status = 'rejected' then
      insert into public.notifications (
        recipient_id,
        sender_id,
        notification_type,
        message,
        related_connection_id
      ) values (
        new.requester_id,
        new.recipient_id,
        'connection_rejected',
        v_recipient_name || ' declined your connection request.',
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_connection_status_updated on public.skill_connections;
create trigger tr_connection_status_updated
  after update of status on public.skill_connections
  for each row execute function public.on_connection_status_updated();

-- Trigger 3: When a message is sent, notify the recipient
create or replace function public.on_message_created()
returns trigger
language plpgsql
security definer
as $$
declare
  v_recipient_id uuid;
  v_sender_name text;
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
  return new;
end;
$$;

drop trigger if exists tr_message_created on public.messages;
create trigger tr_message_created
  after insert on public.messages
  for each row execute function public.on_message_created();

-- ------------------------------------------------------------------------------
-- 9. SUPABASE STORAGE BUCKET FOR AVATARS
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Storage RLS:
create policy "Avatars are publicly accessible"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "Public can upload avatars"
  on storage.objects for insert
  to public
  with check (bucket_id = 'avatars');

create policy "Public can update avatars"
  on storage.objects for update
  to public
  using (bucket_id = 'avatars');

-- ------------------------------------------------------------------------------
-- 10. SECURITY DEFINER RPC FUNCTIONS (Server-side Bridge Account API)
-- ------------------------------------------------------------------------------

-- 1. Register Bridge User
create or replace function public.register_bridge_user(
  p_full_name text,
  p_institute_name text,
  p_bridge_account text,
  p_password_hash text,
  p_avatar_url text default ''
)
returns json
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
  v_normalized_account text;
  v_avatar text;
  v_profile json;
begin
  v_normalized_account := lower(trim(p_bridge_account));
  
  if exists (select 1 from public.profiles where lower(bridge_account) = v_normalized_account) then
    raise exception 'Bridge Account already taken.';
  end if;

  v_avatar := case 
    when p_avatar_url is not null and p_avatar_url <> '' then p_avatar_url
    else 'https://api.dicebear.com/7.x/bottts/svg?seed=' || encode(digest(v_normalized_account, 'sha256'), 'hex')
  end;

  insert into public.profiles (
    full_name,
    institute_name,
    bridge_account,
    avatar_url,
    profile_completed
  ) values (
    trim(p_full_name),
    trim(p_institute_name),
    trim(p_bridge_account),
    v_avatar,
    false
  ) returning id into v_new_id;

  insert into public.user_credentials (
    user_id,
    password_hash
  ) values (
    v_new_id,
    p_password_hash
  );

  select json_build_object(
    'id', id,
    'name', full_name,
    'instituteName', institute_name,
    'bridgeAccount', bridge_account,
    'avatar', avatar_url,
    'profileCompleted', profile_completed,
    'skillsTeach', '[]'::json,
    'skillsLearn', '[]'::json,
    'createdAt', created_at
  ) into v_profile
  from public.profiles
  where id = v_new_id;

  return v_profile;
end;
$$;

-- 2. Get User Credentials for Login
create or replace function public.get_bridge_user_credentials(
  p_bridge_account text
)
returns json
language plpgsql
security definer
as $$
declare
  v_rec record;
begin
  select 
    p.id,
    p.full_name,
    p.institute_name,
    p.bridge_account,
    p.avatar_url,
    p.profile_completed,
    c.password_hash
  into v_rec
  from public.profiles p
  inner join public.user_credentials c on c.user_id = p.id
  where lower(p.bridge_account) = lower(trim(p_bridge_account));

  if not found then
    return null;
  end if;

  return json_build_object(
    'id', v_rec.id,
    'name', v_rec.full_name,
    'instituteName', v_rec.institute_name,
    'bridgeAccount', v_rec.bridge_account,
    'avatar', v_rec.avatar_url,
    'profileCompleted', v_rec.profile_completed,
    'passwordHash', v_rec.password_hash,
    'skillsTeach', coalesce((select json_agg(skill_name) from public.user_skills where user_id = v_rec.id and skill_type = 'teach'), '[]'::json),
    'skillsLearn', coalesce((select json_agg(skill_name) from public.user_skills where user_id = v_rec.id and skill_type = 'learn'), '[]'::json)
  );
end;
$$;

-- 3. Get User Profile by ID
create or replace function public.get_profile_by_id(
  p_user_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_profile json;
begin
  select json_build_object(
    'id', p.id,
    'name', p.full_name,
    'instituteName', p.institute_name,
    'bridgeAccount', p.bridge_account,
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

-- 4. Update Profile
create or replace function public.update_bridge_user_profile(
  p_user_id uuid,
  p_full_name text,
  p_institute_name text,
  p_avatar_url text,
  p_skills_teach text[],
  p_skills_learn text[]
)
returns json
language plpgsql
security definer
as $$
declare
  v_is_completed boolean;
  v_skill text;
begin
  v_is_completed := coalesce(array_length(p_skills_teach, 1), 0) > 0 
                and coalesce(array_length(p_skills_learn, 1), 0) > 0;

  update public.profiles
  set
    full_name = coalesce(trim(p_full_name), full_name),
    institute_name = coalesce(trim(p_institute_name), institute_name),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    profile_completed = v_is_completed,
    updated_at = now()
  where id = p_user_id;

  delete from public.user_skills where user_id = p_user_id;

  if p_skills_teach is not null then
    foreach v_skill in array p_skills_teach loop
      if trim(v_skill) <> '' then
        insert into public.user_skills (user_id, skill_name, skill_type)
        values (p_user_id, trim(v_skill), 'teach')
        on conflict do nothing;
      end if;
    end loop;
  end if;

  if p_skills_learn is not null then
    foreach v_skill in array p_skills_learn loop
      if trim(v_skill) <> '' then
        insert into public.user_skills (user_id, skill_name, skill_type)
        values (p_user_id, trim(v_skill), 'learn')
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return public.get_profile_by_id(p_user_id);
end;
$$;

-- 5. Get Explore Users (Completed profiles only, excluding current user, with skill search)
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
        limit 1
      ), 'none'),
      'connectionId', (
        select sc.id
        from public.skill_connections sc
        where p_current_user_id is not null and (
          (sc.requester_id = p_current_user_id and sc.recipient_id = p.id) or
          (sc.recipient_id = p_current_user_id and sc.requester_id = p.id)
        )
        limit 1
      ),
      'isRequester', coalesce((
        select sc.requester_id = p_current_user_id
        from public.skill_connections sc
        where p_current_user_id is not null and (
          (sc.requester_id = p_current_user_id and sc.recipient_id = p.id) or
          (sc.recipient_id = p_current_user_id and sc.requester_id = p.id)
        )
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

-- 6. Send Connection Request
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

  select * into v_existing
  from public.skill_connections
  where (requester_id = p_requester_id and recipient_id = p_recipient_id)
     or (recipient_id = p_requester_id and requester_id = p_recipient_id);

  if found then
    if v_existing.status = 'pending' then
      raise exception 'A connection request is already pending between you.';
    elsif v_existing.status = 'accepted' then
      raise exception 'You are already connected with this user.';
    else
      update public.skill_connections
      set
        status = 'pending',
        requester_id = p_requester_id,
        recipient_id = p_recipient_id,
        updated_at = now()
      where id = v_existing.id;

      select row_to_json(sc) into v_res from public.skill_connections sc where id = v_existing.id;
      return v_res;
    end if;
  end if;

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

-- 7. Respond to Connection Request (Accept/Reject by Recipient)
create or replace function public.respond_connection_request(
  p_connection_id uuid,
  p_user_id uuid,
  p_status text
)
returns json
language plpgsql
security definer
as $$
declare
  v_conn record;
  v_res json;
begin
  select * into v_conn from public.skill_connections where id = p_connection_id;
  if not found then
    raise exception 'Connection request not found.';
  end if;

  if v_conn.recipient_id <> p_user_id then
    raise exception 'Only the recipient can respond to this connection request.';
  end if;

  if p_status not in ('accepted', 'rejected') then
    raise exception 'Invalid status value.';
  end if;

  update public.skill_connections
  set
    status = p_status,
    updated_at = now()
  where id = p_connection_id
  returning row_to_json(skill_connections.*) into v_res;

  return v_res;
end;
$$;

-- 8. Get User Connections List
create or replace function public.get_user_connections_list(
  p_user_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_list json;
begin
  select json_agg(conn_obj) into v_list
  from (
    select json_build_object(
      'id', sc.id,
      'requesterId', sc.requester_id,
      'recipientId', sc.recipient_id,
      'status', sc.status,
      'createdAt', sc.created_at,
      'updatedAt', sc.updated_at,
      'isRequester', sc.requester_id = p_user_id,
      'partner', (
        select json_build_object(
          'id', p.id,
          'name', p.full_name,
          'instituteName', p.institute_name,
          'bridgeAccount', p.bridge_account,
          'avatar', p.avatar_url,
          'skillsTeach', coalesce((select json_agg(skill_name) from public.user_skills where user_id = p.id and skill_type = 'teach'), '[]'::json),
          'skillsLearn', coalesce((select json_agg(skill_name) from public.user_skills where user_id = p.id and skill_type = 'learn'), '[]'::json)
        )
        from public.profiles p
        where p.id = (case when sc.requester_id = p_user_id then sc.recipient_id else sc.requester_id end)
      )
    ) as conn_obj
    from public.skill_connections sc
    where sc.requester_id = p_user_id or sc.recipient_id = p_user_id
    order by sc.updated_at desc
  ) s;

  return coalesce(v_list, '[]'::json);
end;
$$;

-- 9. Get User Notifications List
create or replace function public.get_user_notifications_list(
  p_user_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_notifs json;
begin
  select json_agg(notif_obj) into v_notifs
  from (
    select json_build_object(
      'id', n.id,
      'recipientId', n.recipient_id,
      'senderId', n.sender_id,
      'type', n.notification_type,
      'message', n.message,
      'relatedConnectionId', n.related_connection_id,
      'read', n.read_status,
      'createdAt', n.created_at,
      'sender', (
        select json_build_object(
          'id', p.id,
          'name', p.full_name,
          'instituteName', p.institute_name,
          'bridgeAccount', p.bridge_account,
          'avatar', p.avatar_url
        )
        from public.profiles p where p.id = n.sender_id
      ),
      'connection', (
        select row_to_json(sc.*)
        from public.skill_connections sc where sc.id = n.related_connection_id
      )
    ) as notif_obj
    from public.notifications n
    where n.recipient_id = p_user_id
    order by n.created_at desc
  ) s;

  return coalesce(v_notifs, '[]'::json);
end;
$$;

-- 10. Mark Notification as Read
create or replace function public.mark_notification_read(
  p_notification_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.notifications
  set read_status = true
  where id = p_notification_id and recipient_id = p_user_id;

  return found;
end;
$$;

-- 11. Mark All Notifications as Read
create or replace function public.mark_all_notifications_read(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.notifications
  set read_status = true
  where recipient_id = p_user_id;

  return true;
end;
$$;

-- 12. Get Connection Messages (Accepted Connection Only)
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
      'createdAt', m.created_at
    ) as msg_obj
    from public.messages m
    where m.connection_id = p_connection_id
    order by m.created_at asc
  ) s;

  return json_build_object(
    'connectionId', p_connection_id,
    'partner', v_partner,
    'messages', coalesce(v_messages, '[]'::json)
  );
end;
$$;

-- 13. Send Connection Message (Accepted Connection Only)
create or replace function public.send_connection_message_entry(
  p_connection_id uuid,
  p_user_id uuid,
  p_message_body text
)
returns json
language plpgsql
security definer
as $$
declare
  v_conn record;
  v_res json;
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
    message_body
  ) values (
    p_connection_id,
    p_user_id,
    trim(p_message_body)
  ) returning json_build_object(
    'id', id,
    'connectionId', connection_id,
    'senderId', sender_id,
    'messageBody', message_body,
    'createdAt', created_at
  ) into v_res;

  return v_res;
end;
$$;

-- ------------------------------------------------------------------------------
-- 11. ROLE GRANTS (Ensure PostgREST roles can access public tables & routines)
-- ------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
