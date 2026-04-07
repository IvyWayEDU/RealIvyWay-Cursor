-- IvyWay: providers storage to Supabase/Postgres
--
-- Creates:
-- - public.providers
--
-- Notes:
-- - Uses the shared updated_at trigger helper (create-or-replace here for ordering safety).

create extension if not exists pgcrypto;

-- Generic updated_at trigger helper (shared across tables)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.providers (
  id text primary key,
  user_id text,
  data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_providers_updated_at on public.providers;
create trigger set_providers_updated_at
before update on public.providers
for each row execute function public.set_updated_at();

create index if not exists providers_user_id_idx on public.providers (user_id);

