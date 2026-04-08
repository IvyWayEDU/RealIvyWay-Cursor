-- IvyWay: support ticketing (Supabase/Postgres)
-- Tables:
-- - support_tickets
-- - support_messages

-- Enable UUID generation (gen_random_uuid)
create extension if not exists pgcrypto;

-- Generic updated_at trigger helper (shared)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  subject text not null,
  status text not null default 'open',
  role text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null,
  unread_for_admin int not null default 0,
  unread_for_user int not null default 0
);

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

create index if not exists support_tickets_user_created_at_idx
on public.support_tickets (user_id, created_at desc);

create index if not exists support_tickets_status_idx
on public.support_tickets (status);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id text not null,
  sender_role text null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_created_at_idx
on public.support_messages (ticket_id, created_at asc);

