-- Party Portal: thank-you cards that open (shared by private link).
-- Run in Supabase -> SQL Editor. Safe to run more than once.

create table if not exists public.thank_cards (
  token           text primary key,
  party_id        uuid not null references public.parties(id) on delete cascade,
  person_key      text not null,
  recipient_name  text not null,
  message         text not null check (char_length(message) <= 5000),
  design_path     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  opened_at       timestamptz,
  unique (party_id, person_key)
);
alter table public.thank_cards enable row level security;
grant select, insert, update, delete on public.thank_cards to service_role;
