-- Hotfix: ensure payout_requests has stripe_transfer_id (production schema drift)
-- Root issue: PostgREST insert fails if the column is missing from the actual DB schema.
-- This migration is idempotent and safe to run in production.

alter table if exists public.payout_requests
  add column if not exists stripe_transfer_id text null;

-- Refresh PostgREST schema cache (Supabase API)
notify pgrst, 'reload schema';

