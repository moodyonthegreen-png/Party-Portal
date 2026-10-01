-- Party Portal: email (host sign-in links and guest reminders).
-- Run in Supabase -> SQL Editor. Safe to run more than once.

alter table public.parties add column if not exists host_link_sent_at timestamptz;
alter table public.guests add column if not exists reminded_at timestamptz;
create index if not exists parties_host_email_idx on public.parties (lower(host_email));
