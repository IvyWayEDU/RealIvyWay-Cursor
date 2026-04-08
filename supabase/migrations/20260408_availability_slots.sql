-- IvyWay: Discrete provider availability slots (bookable inventory)
--
-- Creates:
-- - public.availability_slots
--
-- Notes:
-- - Rows represent concrete start/end windows in UTC (timestamptz).
-- - `is_booked` is a convenience flag; booking integrity still uses sessions + reserved_slots.
-- - `service_type` enables filtering by booking flow serviceType.
-- - We keep booked rows for history/analytics; regenerate flows delete only future unbooked rows.

create extension if not exists pgcrypto;

-- Ensure updated_at helper exists (safe if already present)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  service_type text null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_booked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_slots_end_after_start_chk check (end_time > start_time)
);

drop trigger if exists set_availability_slots_updated_at on public.availability_slots;
create trigger set_availability_slots_updated_at
before update on public.availability_slots
for each row execute function public.set_updated_at();

-- Prevent accidental duplicate slot creation for the same provider/time window.
create unique index if not exists availability_slots_provider_window_uniq
on public.availability_slots (provider_id, start_time, end_time);

create index if not exists availability_slots_provider_id_idx
on public.availability_slots (provider_id);

create index if not exists availability_slots_provider_start_time_idx
on public.availability_slots (provider_id, start_time);

create index if not exists availability_slots_start_time_idx
on public.availability_slots (start_time);

create index if not exists availability_slots_is_booked_idx
on public.availability_slots (is_booked);

create index if not exists availability_slots_service_type_idx
on public.availability_slots (service_type);

