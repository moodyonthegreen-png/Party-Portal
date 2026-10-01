-- Party Portal: shared photo album.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

create table if not exists public.photos (
  id            uuid primary key default gen_random_uuid(),
  party_id      uuid not null references public.parties(id) on delete cascade,
  author_name   text not null check (char_length(trim(author_name)) between 1 and 80),
  caption       text check (caption is null or char_length(caption) <= 200),
  -- Resized copy shown in the album
  image_path    text not null,
  -- Untouched upload, for full-quality downloads
  original_path text not null,
  width         int,
  height        int,
  device_hash   text,
  status        text not null default 'pending' check (status in ('pending', 'visible', 'hidden')),
  created_at    timestamptz not null default now()
);
create index if not exists photos_party_idx on public.photos (party_id, created_at desc);

-- One heart per photo per browser
create table if not exists public.photo_hearts (
  photo_id    uuid not null references public.photos(id) on delete cascade,
  device_hash text not null,
  created_at  timestamptz not null default now(),
  primary key (photo_id, device_hash)
);

alter table public.photos enable row level security;
alter table public.photo_hearts enable row level security;
grant select, insert, update, delete on public.photos, public.photo_hearts to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'])
on conflict (id) do nothing;
