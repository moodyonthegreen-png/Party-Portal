-- Party Portal: group-gift designer.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

-- One saved layout per party per product
create table if not exists public.gift_designs (
  party_id      uuid not null references public.parties(id) on delete cascade,
  product_key   text not null,
  layout        jsonb not null default '{}'::jsonb,
  status        text not null default 'draft' check (status in ('draft', 'final')),
  print_path    text,
  finalized_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (party_id, product_key)
);
alter table public.gift_designs enable row level security;
grant select, insert, update, delete on public.gift_designs to service_role;

-- Finished print files (50 MB is the Supabase free-plan cap)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prints', 'prints', false, 52428800, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
