-- Party Portal: memorial notes, the first pages of the guest book.
-- Added by the host to honor loved ones who have passed.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

create table if not exists public.memorials (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references public.parties(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  relation    text check (relation is null or char_length(relation) <= 80),
  message     text check (message is null or char_length(message) <= 1500),
  media_kind  text check (media_kind in ('photo', 'audio', 'video')),
  media_path  text,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists memorials_party_idx on public.memorials (party_id, sort);
alter table public.memorials enable row level security;
grant select, insert, update, delete on public.memorials to service_role;
