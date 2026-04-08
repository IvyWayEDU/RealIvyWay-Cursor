-- IvyWay: referral credits to Supabase/Postgres

create table if not exists public.referral_credits (
  id uuid primary key,
  user_id text not null,
  referred_user_id text null,
  amount_cents integer not null,
  status text not null check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_credits_user_id_idx on public.referral_credits (user_id);
create index if not exists referral_credits_referred_user_id_idx on public.referral_credits (referred_user_id);
create index if not exists referral_credits_created_at_idx on public.referral_credits (created_at);

drop trigger if exists set_referral_credits_updated_at on public.referral_credits;
create trigger set_referral_credits_updated_at
before update on public.referral_credits
for each row execute function public.set_updated_at();

