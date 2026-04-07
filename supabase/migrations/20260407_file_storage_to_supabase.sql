-- IvyWay: migrate JSON file storage to Supabase/Postgres
-- Tables required by app runtime:
-- - sessions
-- - bookings
-- - reserved_slots
-- - users

-- Enable UUID generation (gen_random_uuid)
create extension if not exists pgcrypto;

-- Generic updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- USERS
create table if not exists public.users (
  id text primary key,
  email text not null unique,
  role text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create index if not exists users_role_idx on public.users (role);

-- SESSIONS
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  provider_id text not null,
  datetime timestamptz not null,
  -- Not listed in the minimal spec, but required to preserve booking integrity
  end_datetime timestamptz null,
  status text not null,
  -- Full session payload (the app reads/writes many more fields than the minimal columns)
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_sessions_updated_at on public.sessions;
create trigger set_sessions_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create index if not exists sessions_student_id_idx on public.sessions (student_id);
create index if not exists sessions_provider_id_idx on public.sessions (provider_id);
create index if not exists sessions_datetime_idx on public.sessions (datetime);

-- BOOKINGS (checkout booking context)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id text unique,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists bookings_checkout_session_id_idx on public.bookings (checkout_session_id);

-- RESERVED SLOTS (booking integrity / anti-race)
create table if not exists public.reserved_slots (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  datetime timestamptz not null,
  -- Not listed in the minimal spec, but required to uniquely identify a window.
  end_datetime timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider_id, datetime, end_datetime)
);

create index if not exists reserved_slots_provider_datetime_idx on public.reserved_slots (provider_id, datetime);

-- Atomic reservation RPC (transactional all-or-nothing)
create or replace function public.reserve_slots_atomically(slots jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  conflict_provider_id text;
  conflict_start timestamptz;
  conflict_end timestamptz;
begin
  if slots is null or jsonb_typeof(slots) <> 'array' then
    raise exception 'slots must be a JSON array';
  end if;

  -- Detect any conflict first (in the same transaction).
  select
    rs.provider_id,
    rs.datetime,
    rs.end_datetime
  into
    conflict_provider_id,
    conflict_start,
    conflict_end
  from public.reserved_slots rs
  where exists (
    select 1
    from jsonb_array_elements(slots) s
    where
      rs.provider_id = (s->>'provider_id')::text
      and rs.datetime = (s->>'datetime')::timestamptz
      and rs.end_datetime = (s->>'end_datetime')::timestamptz
  )
  limit 1;

  if conflict_provider_id is not null then
    return jsonb_build_object(
      'ok', false,
      'conflict', jsonb_build_object(
        'provider_id', conflict_provider_id,
        'datetime', conflict_start,
        'end_datetime', conflict_end
      )
    );
  end if;

  insert into public.reserved_slots (provider_id, datetime, end_datetime)
  select
    (s->>'provider_id')::text,
    (s->>'datetime')::timestamptz,
    (s->>'end_datetime')::timestamptz
  from jsonb_array_elements(slots) s;

  return jsonb_build_object('ok', true);
end;
$$;

