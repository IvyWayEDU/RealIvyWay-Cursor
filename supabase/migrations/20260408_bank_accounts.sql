-- IvyWay: bank account storage (Supabase/Postgres)
-- Replaces local JSON storage for bank accounts.

create extension if not exists pgcrypto;

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null unique,
  account_name text not null,
  account_number text not null,
  routing_number text not null,
  bank_name text not null,
  account_type text not null default 'checking',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_accounts_account_type_check check (account_type in ('checking', 'savings')),
  constraint bank_accounts_status_check check (status in ('active', 'disconnected'))
);

drop trigger if exists set_bank_accounts_updated_at on public.bank_accounts;
create trigger set_bank_accounts_updated_at
before update on public.bank_accounts
for each row execute function public.set_updated_at();

create index if not exists bank_accounts_provider_id_idx on public.bank_accounts (provider_id);

