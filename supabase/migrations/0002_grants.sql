-- Make sure the server's service role can use the Party Portal tables.
-- Some Supabase projects don't grant new tables to the API roles
-- automatically. Safe to run more than once.

grant usage on schema public to service_role;
grant select, insert, update, delete on public.parties, public.guests, public.designs to service_role;
grant execute on function public.check_party_password(text, text) to service_role;
grant execute on function public.touch_updated_at() to service_role;
