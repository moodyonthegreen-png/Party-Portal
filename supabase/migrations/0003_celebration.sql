-- Party Portal: celebration details for the themed guest site.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

alter table public.parties add column if not exists event_date timestamptz;
alter table public.parties add column if not exists tagline text;
alter table public.parties alter column theme set default 'explorer';

-- Refresh the demo party so it shows off the Explorer theme
update public.parties
set theme = 'explorer',
    guest_of_honor_name = 'Jessica',
    title = null,
    tagline = 'The mom-to-be',
    welcome_message = 'We''re celebrating the mom-to-be! Leave Jessica a note, share a photo, and add your design to a gift made by everyone who loves her.',
    event_date = date_trunc('day', now()) + interval '20 days' + interval '14 hours',
    registry_url = 'https://www.example.com/registry',
    sections = '{"design": true, "album": true, "messages": true, "games": true, "registry": true}'::jsonb
where slug = 'demo-shower';
