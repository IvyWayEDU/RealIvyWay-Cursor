-- IvyWay: messaging (conversations + messages) to Supabase/Postgres

-- Ensure UUID generation exists for message ids.
create extension if not exists pgcrypto;

-- CONVERSATIONS
create table if not exists public.conversations (
  id text primary key,
  participant_a text not null,
  participant_b text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Basic sanity (cannot message yourself)
  constraint conversations_participants_distinct check (participant_a <> participant_b),
  -- Avoid duplicates (we always store normalized order app-side)
  constraint conversations_participants_unique unique (participant_a, participant_b)
);

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create index if not exists conversations_participant_a_idx on public.conversations (participant_a);
create index if not exists conversations_participant_b_idx on public.conversations (participant_b);

-- MESSAGES
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);
create index if not exists messages_sender_id_idx on public.messages (sender_id);

