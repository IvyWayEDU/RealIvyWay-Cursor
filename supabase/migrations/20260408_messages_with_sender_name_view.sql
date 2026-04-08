-- IvyWay: messages view with sender name
--
-- Used by dashboard message preview so the UI can display real names instead of raw ids.
-- We use a LEFT JOIN so messages don't disappear if a user record is missing.

create or replace view public.messages_with_sender_name as
select
  m.*,
  u.data->>'name' as sender_name
from public.messages m
left join public.users u
  on u.id = m.sender_id;

