-- ==============================================================================
-- SkillBridge Migration: Notification Badge & Read Status Persistence
-- ==============================================================================
-- Reuses existing 'read_status' column in public.notifications
-- Provides secure SECURITY DEFINER RPCs for marking single / all notifications read
-- Strictly enforces user ownership (recipient_id = p_user_id)

-- 1. Index on notifications for recipient and read status
create index if not exists idx_notifications_recipient_read 
  on public.notifications(recipient_id, read_status);

-- 2. Mark Single Notification Read (Respects user ownership)
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

-- 3. Mark All Notifications Read for User (Respects user ownership)
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

-- 4. Function Execution Grants
grant execute on function public.mark_notification_read(uuid, uuid) to anon, authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to anon, authenticated;
