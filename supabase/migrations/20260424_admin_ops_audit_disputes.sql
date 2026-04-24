-- IvyWay: admin operational audit + disputes + payout overrides
-- Launch-critical tables so admins never need SQL for day-to-day operations.

-- Append-only admin action log (server-side authoritative)
create table if not exists public.admin_action_log (
  id text primary key,
  admin_user_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists admin_action_log_created_at_idx
  on public.admin_action_log (created_at desc);

create index if not exists admin_action_log_entity_idx
  on public.admin_action_log (entity_type, entity_id, created_at desc);

create index if not exists admin_action_log_admin_idx
  on public.admin_action_log (admin_user_id, created_at desc);

-- Provider earnings adjustments (signed cents) for safe payout overrides / clawbacks.
create table if not exists public.provider_earnings_adjustments (
  id text primary key,
  provider_id text not null,
  amount_cents integer not null,
  reason text null,
  related_session_id text null,
  related_payout_request_id text null,
  created_by_admin text null,
  created_at timestamptz not null default now()
);

create index if not exists provider_earnings_adjustments_provider_id_idx
  on public.provider_earnings_adjustments (provider_id, created_at desc);

create index if not exists provider_earnings_adjustments_session_id_idx
  on public.provider_earnings_adjustments (related_session_id, created_at desc);

create index if not exists provider_earnings_adjustments_payout_request_id_idx
  on public.provider_earnings_adjustments (related_payout_request_id, created_at desc);

-- Session disputes (admin resolution workflow).
create table if not exists public.session_disputes (
  id text primary key,
  session_id text not null,
  student_id text null,
  provider_id text null,
  status text not null default 'open', -- open | resolved | rejected
  opened_at timestamptz not null default now(),
  opened_by text null,
  reason text null,
  resolution text null,
  resolved_at timestamptz null,
  resolved_by text null,
  metadata jsonb null
);

create unique index if not exists session_disputes_session_id_open_uniq
  on public.session_disputes (session_id)
  where (status = 'open');

create index if not exists session_disputes_status_idx
  on public.session_disputes (status, opened_at desc);

create index if not exists session_disputes_session_id_idx
  on public.session_disputes (session_id, opened_at desc);

-- Ensure PostgREST schema cache is refreshed (Supabase API).
notify pgrst, 'reload schema';

