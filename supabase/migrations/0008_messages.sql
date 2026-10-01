-- Party Portal: message board (notes, voice memos, short videos).
-- Run in Supabase -> SQL Editor. Safe to run more than once.

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid not null references public.parties(id) on delete cascade,
  author_name  text not null check (char_length(trim(author_name)) between 1 and 80),
  body         text check (body is null or char_length(body) <= 1500),
  media_path   text,
  media_type   text check (media_type is null or media_type in ('audio', 'video')),
  -- Hash of the posting browser's token, so guests can delete their own note
  device_hash  text,
  -- pending: waiting for its voice memo or video to finish uploading
  status       text not null default 'visible' check (status in ('pending', 'visible', 'hidden')),
  created_at   timestamptz not null default now()
);

create index if not exists messages_party_idx on public.messages (party_id, created_at desc);
alter table public.messages enable row level security;
grant select, insert, update, delete on public.messages to service_role;

-- Private bucket for voice memos and videos (50 MB is the Supabase free-plan cap)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800,
        array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/x-m4a', 'audio/wav',
              'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;
