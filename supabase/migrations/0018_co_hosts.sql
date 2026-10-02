-- Party Portal: co-hosts (the guest of honor, or a helper) with their own link.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
--
-- Each co-host gets their own secret dashboard link. Only a SHA-256 hash of
-- it is stored. Making a new link for one person never affects anyone else.

create table if not exists public.co_hosts (
  id              uuid primary key default gen_random_uuid(),
  party_id        uuid not null references public.parties(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  email           text not null check (char_length(email) <= 200),
  role            text not null default 'guest_of_honor' check (role in ('guest_of_honor', 'helper')),
  token_hash      text,
  link_sent_at    timestamptz,
  last_opened_at  timestamptz,
  created_at      timestamptz not null default now()
);
create unique index if not exists co_hosts_token_hash_key on public.co_hosts (token_hash) where token_hash is not null;
create unique index if not exists co_hosts_party_email_key on public.co_hosts (party_id, lower(email));
create index if not exists co_hosts_email_idx on public.co_hosts (lower(email));
alter table public.co_hosts enable row level security;
grant select, insert, update, delete on public.co_hosts to service_role;

-- Thank-you cards are signed by whoever sends them
alter table public.thank_cards add column if not exists from_name text;
