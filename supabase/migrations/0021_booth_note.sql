-- Party Portal: photo booth "Just a note" option.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
alter table public.photos drop constraint if exists photos_prompt_check;
alter table public.photos add constraint photos_prompt_check check (prompt is null or prompt in ('note', 'intro', 'memory'));
