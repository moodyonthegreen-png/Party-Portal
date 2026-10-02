-- Party Portal: welcome video and welcome photos on the guest page.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

alter table public.parties add column if not exists welcome_video_path text;
alter table public.parties add column if not exists welcome_video_by text;

create table if not exists public.welcome_photos (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references public.parties(id) on delete cascade,
  image_path  text not null,
  caption     text check (caption is null or char_length(caption) <= 140),
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists welcome_photos_party_idx on public.welcome_photos (party_id, sort);
alter table public.welcome_photos enable row level security;
grant select, insert, update, delete on public.welcome_photos to service_role;
