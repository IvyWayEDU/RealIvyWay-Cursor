-- IvyWay: fix payout_requests schema drift
-- If payout_requests existed before 20260408_payouts_and_earnings_balances.sql,
-- `create table if not exists` would not have added newer columns.

alter table if exists public.payout_requests
  add column if not exists stripe_transfer_id text null;

-- Ensure PostgREST schema cache is refreshed (Supabase API).
notify pgrst, 'reload schema';

