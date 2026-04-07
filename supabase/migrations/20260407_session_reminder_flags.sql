-- Automated session reminder / follow-up flags.
-- These booleans are used by a repeatable scheduled job to ensure emails are sent once.

alter table if exists public.sessions
  add column if not exists reminder_24h_sent boolean not null default false,
  add column if not exists reminder_1h_sent boolean not null default false,
  add column if not exists followup_sent boolean not null default false;

-- Helpful indexes for cron queries (safe to run repeatedly).
create index if not exists sessions_datetime_idx on public.sessions (datetime);
create index if not exists sessions_end_datetime_idx on public.sessions (end_datetime);
create index if not exists sessions_reminder_24h_sent_idx on public.sessions (reminder_24h_sent);
create index if not exists sessions_reminder_1h_sent_idx on public.sessions (reminder_1h_sent);
create index if not exists sessions_followup_sent_idx on public.sessions (followup_sent);

