-- Demo party for local testing: open /p/demo-shower once this is loaded.
insert into public.parties
  (slug, guest_of_honor_name, occasion, title, welcome_message, deadline, host_email, host_name)
values
  ('demo-shower', 'Jessica', 'Baby shower', null,
   'We''re celebrating the mom-to-be! Leave Jessica a note, share a photo, and add your design to a gift made by everyone who loves her.',
   now() + interval '14 days', 'host@example.com', 'Jessie')
on conflict (slug) do nothing;

insert into public.guests (party_id, name, added_by)
select id, n, 'host'
from public.parties, unnest(array['Aunt Mimi', 'Grandpa Joe', 'Taylor', 'Sam']) as n
where slug = 'demo-shower'
on conflict do nothing;
