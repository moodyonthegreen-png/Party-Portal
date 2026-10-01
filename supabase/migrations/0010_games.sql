-- Party Portal: games (Guess the Baby Photo, Due Date & Birth Weight Pool).
-- Run in Supabase -> SQL Editor. Safe to run more than once.

-- Per-party game settings and results, e.g.
-- {"babyPhotos": {"on": true, "revealed": false},
--  "pool": {"on": true, "closed": false, "actual": {"date": "2026-11-02", "time": "04:12", "weightOz": 118, "lengthIn": 20.5}}}
alter table public.parties add column if not exists games jsonb not null
  default '{"babyPhotos": {"on": true, "revealed": false}, "pool": {"on": true, "closed": false, "actual": null}}'::jsonb;

-- Baby photos the host adds, each with who it really is
create table if not exists public.baby_photos (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references public.parties(id) on delete cascade,
  image_path  text not null,
  answer      text not null check (char_length(trim(answer)) between 1 and 80),
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists baby_photos_party_idx on public.baby_photos (party_id, sort, created_at);

-- One set of guesses per browser: {"<baby photo id>": "<name guessed>"}
create table if not exists public.baby_photo_guesses (
  party_id     uuid not null references public.parties(id) on delete cascade,
  device_hash  text not null,
  player_name  text not null check (char_length(trim(player_name)) between 1 and 80),
  guesses      jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (party_id, device_hash)
);

-- One pool entry per browser
create table if not exists public.pool_entries (
  party_id     uuid not null references public.parties(id) on delete cascade,
  device_hash  text not null,
  player_name  text not null check (char_length(trim(player_name)) between 1 and 80),
  birth_date   date not null,
  birth_time   time,
  weight_oz    int not null check (weight_oz between 16 and 240),
  length_in    numeric(4,1) check (length_in is null or length_in between 10 and 30),
  updated_at   timestamptz not null default now(),
  primary key (party_id, device_hash)
);

alter table public.baby_photos enable row level security;
alter table public.baby_photo_guesses enable row level security;
alter table public.pool_entries enable row level security;
grant select, insert, update, delete on public.baby_photos, public.baby_photo_guesses, public.pool_entries to service_role;
