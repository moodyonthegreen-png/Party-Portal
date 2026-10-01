-- Party Portal: host access.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
--
-- Each party gets a secret host link. Only a SHA-256 hash of the secret is
-- stored, so the link can't be recovered from the database: if a host loses
-- it, we make a new one (which also switches the old one off).

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

-- Make a fresh host link for the demo party and show it.
-- Copy the "host_link" value from the results and put your site address in front of it.
with fresh as (
  select encode(gen_random_bytes(24), 'hex') as token
), updated as (
  update public.parties p
  set host_token_hash = encode(digest(fresh.token, 'sha256'), 'hex')
  from fresh
  where p.slug = 'demo-shower'
  returning fresh.token
)
select '/h/' || token as host_link from updated;
