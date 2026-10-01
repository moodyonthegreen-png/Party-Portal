-- Party Portal: Printify product photos for products a host is previewing
-- (not bought yet). Run in Supabase -> SQL Editor. Safe to run more than once.

create table if not exists public.gift_previews (
  party_id            uuid not null references public.parties(id) on delete cascade,
  product_key         text not null,
  file_path           text,
  printify_product_id text,
  printify_provider   text,
  mockups             jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  primary key (party_id, product_key)
);
alter table public.gift_previews enable row level security;
grant select, insert, update, delete on public.gift_previews to service_role;
