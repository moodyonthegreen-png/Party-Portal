-- Party Portal: make (or replace) a party's secret host link.
-- Run in Supabase -> SQL Editor. The result shows one row with "host_link":
-- put your site address in front of it and open it.
--
-- Making a new link switches off the previous one.
-- Includes the host setup from 0006, so it's fine to run this one on its own.

alter table public.parties add column if not exists host_token_hash text;
create unique index if not exists parties_host_token_hash_key
  on public.parties (host_token_hash) where host_token_hash is not null;

-- Set or clear the party password (bcrypt). Called from the server only.
create or replace function public.set_party_password(p_party_id uuid, p_password text)
returns void
language sql security definer set search_path = public, extensions as $$
  update public.parties
  set password_hash = case
    when p_password is null or btrim(p_password) = '' then null
    else crypt(p_password, gen_salt('bf'))
  end
  where id = p_party_id;
$$;
revoke all on function public.set_party_password(uuid, text) from public, anon, authenticated;
grant execute on function public.set_party_password(uuid, text) to service_role;


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
