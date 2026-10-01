-- Party Portal: Printify product photos for finished gift designs.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

alter table public.gift_designs add column if not exists printify_product_id text;
alter table public.gift_designs add column if not exists printify_provider text;
alter table public.gift_designs add column if not exists mockups jsonb not null default '[]'::jsonb;
