-- IvyWay: notifications to Supabase/Postgres

create table if not exists public.notifications (
  id text primary key,
  user_id text not null,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_id_read_idx
  on public.notifications (user_id, read);

