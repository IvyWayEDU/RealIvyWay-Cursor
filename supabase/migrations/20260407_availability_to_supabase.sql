-- IvyWay: Supabase-backed availability storage (no filesystem persistence)
--
-- Runtime tables required by app:
-- - availability
--
-- Notes:
-- - This stores the canonical availability payload the app reads/writes (JSONB),
--   keyed by (provider_id, service_type).
-- - `reserved_slots` is handled separately (see other migration).

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

-- AVAILABILITY
create table if not exists public.availability (
  provider_id text not null,
  service_type text not null,
  timezone text null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_id, service_type)
);

drop trigger if exists set_availability_updated_at on public.availability;
create trigger set_availability_updated_at
before update on public.availability
for each row execute function public.set_updated_at();

create index if not exists availability_provider_id_idx on public.availability (provider_id);
create index if not exists availability_service_type_idx on public.availability (service_type);

