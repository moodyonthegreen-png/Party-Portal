-- Party Portal: make the classic sage-and-buttercup theme the default
-- and switch the demo party to it. Safe to run more than once.

alter table public.parties alter column theme set default 'classic';

update public.parties set theme = 'classic' where slug = 'demo-shower';
