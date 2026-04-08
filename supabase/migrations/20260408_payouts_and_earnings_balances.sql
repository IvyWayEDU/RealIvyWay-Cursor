-- IvyWay: payouts + provider earnings balances (Supabase/Postgres)
-- Adds runtime tables required for serverless (no filesystem).

-- Provider earnings balances (single row per provider)
create table if not exists public.provider_earnings_balances (
  provider_id text primary key,
  available_cents integer not null default 0,
  pending_cents integer not null default 0,
  withdrawn_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_provider_earnings_balances_updated_at on public.provider_earnings_balances;
create trigger set_provider_earnings_balances_updated_at
before update on public.provider_earnings_balances
for each row execute function public.set_updated_at();

create index if not exists provider_earnings_balances_provider_id_idx
  on public.provider_earnings_balances (provider_id);

-- Earnings credits (idempotency ledger by session)
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

-- Payout requests (admin-reviewed withdrawals)
create table if not exists public.payout_requests (
  id text primary key,
  provider_id text not null,
  amount_cents integer not null,
  status text not null default 'pending',
  allocations jsonb null,
  allocations_inferred boolean null,

  payout_method text null,
  payout_destination_masked text null,
  payout_destination text null,

  bank_name text null,
  bank_account_number text null,
  bank_routing_number text null,
  bank_country text null,
  account_holder_name text null,

  wise_email text null,
  paypal_email text null,
  zelle_contact text null,

  stripe_transfer_id text null,
  approved_at timestamptz null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_payout_requests_updated_at on public.payout_requests;
create trigger set_payout_requests_updated_at
before update on public.payout_requests
for each row execute function public.set_updated_at();

create index if not exists payout_requests_provider_id_created_at_idx
  on public.payout_requests (provider_id, created_at desc);

