-- Join tracking + payout enforcement support columns.
-- Source of truth remains the JSON `sessions.data` payload; these columns are mirrored for
-- easier querying/auditing and future DB-side enforcement.

alter table if exists public.sessions
  add column if not exists provider_joined_at timestamptz null,
  add column if not exists student_joined_at timestamptz null;

create index if not exists sessions_provider_joined_at_idx
  on public.sessions (provider_joined_at);

create index if not exists sessions_student_joined_at_idx
  on public.sessions (student_joined_at);

