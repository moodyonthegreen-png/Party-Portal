-- Party Portal: answers for newer games (starting with baby animal names).
-- One row per game per guest browser. Run in Supabase -> SQL Editor. Safe to run more than once.

create table if not exists public.game_answers (
  party_id     uuid not null references public.parties(id) on delete cascade,
  game         text not null check (char_length(game) between 1 and 40),
  device_hash  text not null,
  player_name  text not null check (char_length(player_name) between 1 and 80),
  answers      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  primary key (party_id, game, device_hash)
);
alter table public.game_answers enable row level security;
grant select, insert, update, delete on public.game_answers to service_role;
