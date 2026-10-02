-- Party Portal: photo booth. Guests introduce themselves or share a memory with their photo.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

alter table public.photos add column if not exists prompt text;
alter table public.photos add column if not exists story text;
do $$ begin
  alter table public.photos add constraint photos_prompt_check check (prompt is null or prompt in ('note', 'intro', 'memory'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.photos add constraint photos_story_check check (story is null or char_length(story) <= 600);
exception when duplicate_object then null; end $$;
