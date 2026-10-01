-- Party Portal: initial schema
-- Run in Supabase -> SQL Editor (or `supabase db push` with the CLI).
--
-- Security model: guests never get Supabase accounts. Row Level Security is
-- turned ON for every table with NO policies for the anon role, so the
-- browser cannot read or write anything directly. All guest actions go
-- through the Next.js server, which uses the service-role key and enforces
-- party rules (deadline, password, sections) itself.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Parties: one row per purchased party package
-- ---------------------------------------------------------------------------
create table public.parties (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique
                        check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  -- Who the party is for, e.g. "Baby Harper" or "Jessie"
  guest_of_honor_name text not null,
  -- e.g. "Baby shower", "Birthday"
  occasion            text not null default 'Baby shower',
  title               text,
  welcome_message     text,
  deadline            timestamptz not null,
  theme               text not null default 'classic',
  cover_photo_path    text,
  -- Optional guest password (bcrypt via pgcrypto crypt()). Null = no password.
  password_hash       text,
  -- Which guest sections are switched on
  sections            jsonb not null default
                        '{"design": true, "album": true, "messages": true, "games": false, "registry": false}'::jsonb,
  registry_url        text,
  host_email          text not null,
  host_name           text,
  -- If true, guests must pick from the host's guest list
  require_guest_list  boolean not null default false,
  -- Link back to the Shopify order that created this party
  shopify_order_id    text unique,
  package_type        text not null default 'boxed'
                        check (package_type in ('boxed', 'digital')),
  status              text not null default 'collecting'
                        check (status in ('setup', 'collecting', 'designing', 'finalized', 'printing', 'shipped')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Guests: either pre-loaded by the host or created when a guest types a name
-- ---------------------------------------------------------------------------
create table public.guests (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references public.parties(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 80),
  email       text,
  added_by    text not null default 'guest' check (added_by in ('host', 'guest')),
  -- Hash of a random token saved in the guest's browser on first upload, so
  -- only that browser (or the host) can replace this guest's design.
  claim_token_hash text,
  created_at  timestamptz not null default now()
);
create unique index guests_party_name_unique
  on public.guests (party_id, lower(trim(name)));

-- ---------------------------------------------------------------------------
-- Designs: one current design per guest (replacing overwrites it)
-- ---------------------------------------------------------------------------
create table public.designs (
  id             uuid primary key default gen_random_uuid(),
  party_id       uuid not null references public.parties(id) on delete cascade,
  guest_id       uuid not null references public.guests(id) on delete cascade,
  -- Processed transparent PNG used on the blanket
  image_path     text not null,
  -- Untouched upload, kept so we can re-process at full quality later
  original_path  text not null,
  width          int,
  height         int,
  source         text not null default 'photo' check (source in ('photo', 'drawn')),
  blur_score     real,
  status         text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (party_id, guest_id)
);

create index designs_party_idx on public.designs (party_id);

-- Keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger parties_touch before update on public.parties
  for each row execute function public.touch_updated_at();
create trigger designs_touch before update on public.designs
  for each row execute function public.touch_updated_at();

-- Password check helper, called from the server only
create or replace function public.check_party_password(p_slug text, p_password text)
returns boolean
language sql security definer set search_path = public, extensions as $$
  select coalesce(
    (select password_hash is null or password_hash = crypt(p_password, password_hash)
       from public.parties where slug = p_slug),
    false);
$$;
revoke all on function public.check_party_password(text, text) from public, anon, authenticated;
grant execute on function public.check_party_password(text, text) to service_role;

-- Lock everything down; server uses the service role.
alter table public.parties enable row level security;
alter table public.guests  enable row level security;
alter table public.designs enable row level security;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for design images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('designs', 'designs', false, 15728640,
        array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;
