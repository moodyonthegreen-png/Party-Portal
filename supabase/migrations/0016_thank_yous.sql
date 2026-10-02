-- Party Portal: thank-you helper.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

-- One row per person the host is thanking. People are matched by name
-- (lower-cased), since guests can take part without being on the guest list.
create table if not exists public.thank_yous (
  party_id    uuid not null references public.parties(id) on delete cascade,
  person_key  text not null,
  gift_note   text check (gift_note is null or char_length(gift_note) <= 300),
  thanked_at  timestamptz,
  emailed_at  timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (party_id, person_key)
);
alter table public.thank_yous enable row level security;
grant select, insert, update, delete on public.thank_yous to service_role;
