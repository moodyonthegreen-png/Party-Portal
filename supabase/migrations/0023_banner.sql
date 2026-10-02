-- Party Portal: editable banner text on the guest page.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
alter table public.parties add column if not exists banner_top text;
alter table public.parties add column if not exists banner_headline text;
