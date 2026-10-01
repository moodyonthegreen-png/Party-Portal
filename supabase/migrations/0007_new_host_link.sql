-- Party Portal: make (or replace) a party's secret host link.
-- Run in Supabase -> SQL Editor. The result shows one row with "host_link":
-- put your site address in front of it and open it.
--
-- Making a new link switches off the previous one.

create or replace function public.new_host_link(p_slug text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
begin
  update public.parties
  set host_token_hash = encode(digest(v_token, 'sha256'), 'hex')
  where slug = p_slug;

  if not found then
    return 'No party found with the code ' || p_slug;
  end if;
  return '/h/' || v_token;
end $$;
revoke all on function public.new_host_link(text) from public, anon, authenticated;
grant execute on function public.new_host_link(text) to service_role;

select public.new_host_link('demo-shower') as host_link;
