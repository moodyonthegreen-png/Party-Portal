-- Party Portal: celebration wording and registry for the demo party.
-- Includes everything from 0003, so it's fine to run this one on its own.
-- Safe to run more than once.

alter table public.parties add column if not exists event_date timestamptz;
alter table public.parties add column if not exists tagline text;
alter table public.parties alter column theme set default 'classic';

update public.parties
set theme = 'classic',
    guest_of_honor_name = 'Jessica',
    title = null,
    tagline = 'The mom-to-be',
    welcome_message = 'We''re celebrating the mom-to-be! We can''t all be in one room, so come on in from wherever you are. Leave Jessica a note, share a photo, and add your design to a gift made by everyone who loves her.',
    event_date = coalesce(event_date, date_trunc('day', now()) + interval '20 days' + interval '14 hours'),
    registry_url = coalesce(registry_url, 'https://www.example.com/registry'),
    sections = '{"design": true, "album": true, "messages": true, "games": true, "registry": true}'::jsonb
where slug = 'demo-shower';
