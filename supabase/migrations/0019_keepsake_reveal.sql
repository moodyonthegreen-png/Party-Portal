-- Party Portal: keepsake reveal for the guest of honor.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

alter table public.parties add column if not exists reveal_token text;
alter table public.parties add column if not exists reveal_email text;
alter table public.parties add column if not exists reveal_auto boolean not null default false;
alter table public.parties add column if not exists reveal_sent_at timestamptz;
alter table public.parties add column if not exists reveal_opened_at timestamptz;
create unique index if not exists parties_reveal_token_key on public.parties (reveal_token) where reveal_token is not null;
