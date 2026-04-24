-- IvyWay: provider earnings credits ledger
-- Root-cause fix for `[earnings] auto-credit failed`:
-- ensure the ledger table exists in PostgREST schema cache.

create table if not exists public.provider_earnings_credits (
  id text primary key,
  provider_id text not null,
  session_id text not null,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists provider_earnings_credits_session_id_uniq
  on public.provider_earnings_credits (session_id);

create index if not exists provider_earnings_credits_provider_id_idx
  on public.provider_earnings_credits (provider_id);

