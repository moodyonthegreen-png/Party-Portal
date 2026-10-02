-- Party Portal: "Who has the daddy?" / "Who has the mommy?" scratch-off game.
-- Each guest draws one numbered card; one secret card number hides the clear photo.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

-- The secret winning card number (kept out of the games settings guests can see)
alter table public.parties add column if not exists scratch_winner int;

create table if not exists public.scratch_cards (
  party_id     uuid not null references public.parties(id) on delete cascade,
  card_no      int not null check (card_no >= 1),
  device_hash  text not null,
  player_name  text not null check (char_length(player_name) between 1 and 80),
  is_winner    boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (party_id, card_no),
  unique (party_id, device_hash)
);
alter table public.scratch_cards enable row level security;
grant select, insert, update, delete on public.scratch_cards to service_role;
