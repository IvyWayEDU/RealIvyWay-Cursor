-- IvyWay: password reset tokens (custom auth)

create extension if not exists pgcrypto;

-- Table stores ONLY a hash of the reset token (never the raw token).
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  request_ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

-- Ensure reset tokens are secure hashes (sha256 hex = 64 chars).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'password_reset_tokens_token_hash_is_sha256_hex'
  ) then
    alter table public.password_reset_tokens
      add constraint password_reset_tokens_token_hash_is_sha256_hex
      check (token_hash ~ '^[0-9a-f]{64}$');
  end if;
end $$;

-- Enforce uniqueness of token hashes (single-use, non-guessable).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'password_reset_tokens_token_hash_key'
  ) then
    alter table public.password_reset_tokens
      add constraint password_reset_tokens_token_hash_key unique (token_hash);
  end if;
end $$;

-- At most one active (unused) token per user at a time.
create unique index if not exists password_reset_tokens_one_active_per_user_idx
  on public.password_reset_tokens (user_id)
  where used_at is null;

create index if not exists password_reset_tokens_user_id_idx
  on public.password_reset_tokens (user_id);

create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens (expires_at);

create index if not exists password_reset_tokens_expires_at_unused_idx
  on public.password_reset_tokens (expires_at)
  where used_at is null;

-- Cleanup helper for scheduled jobs / maintenance.
create or replace function public.cleanup_password_reset_tokens(p_now timestamptz default now())
returns bigint
language sql
as $$
  with deleted as (
    delete from public.password_reset_tokens
    where expires_at <= p_now
       or used_at is not null
    returning 1
  )
  select count(*)::bigint from deleted;
$$;

-- Prevent accidental exposure via the public API; server uses service role.
alter table public.password_reset_tokens enable row level security;

