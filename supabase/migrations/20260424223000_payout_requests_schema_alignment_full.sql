-- IvyWay: payout_requests full schema alignment (production drift fix)
-- Production can have an older `public.payout_requests` created before the full table definition landed.
-- `create table if not exists` does not backfill newly-added columns, so PostgREST inserts can fail
-- when the API payload includes columns missing from the actual DB schema.
--
-- This migration is intentionally additive + idempotent: it adds every column referenced by the
-- payout request insert/update code paths, then refreshes the PostgREST schema cache.

alter table if exists public.payout_requests
  add column if not exists allocations jsonb null,
  add column if not exists allocations_inferred boolean null,

  add column if not exists payout_method text null,
  add column if not exists payout_destination_masked text null,
  add column if not exists payout_destination text null,

  add column if not exists bank_name text null,
  add column if not exists bank_account_number text null,
  add column if not exists bank_routing_number text null,
  add column if not exists bank_country text null,
  add column if not exists account_holder_name text null,

  add column if not exists wise_email text null,
  add column if not exists paypal_email text null,
  add column if not exists zelle_contact text null,

  add column if not exists stripe_transfer_id text null,
  add column if not exists approved_at timestamptz null,
  add column if not exists paid_at timestamptz null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Ensure updated_at is maintained if the table existed before triggers were added.
do $$
begin
  if to_regclass('public.payout_requests') is not null then
    drop trigger if exists set_payout_requests_updated_at on public.payout_requests;
    create trigger set_payout_requests_updated_at
    before update on public.payout_requests
    for each row execute function public.set_updated_at();
  end if;
end
$$;

-- Refresh PostgREST schema cache (Supabase API).
notify pgrst, 'reload schema';

