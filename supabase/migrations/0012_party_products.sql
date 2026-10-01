-- Party Portal: which gift products each party has bought.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

-- The product included in the party package
alter table public.parties add column if not exists gift_product text not null default 'fleece-blanket';
-- Extra products bought later as upsells
alter table public.parties add column if not exists extra_products text[] not null default '{}';
