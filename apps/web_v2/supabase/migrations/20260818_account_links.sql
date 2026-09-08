-- Publisher-owned CMS links for /play government cards.
-- Social + curated resident tasks. Archive stays in dot_gov; this is the applied spine.

create table if not exists public.account_links (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.accounts(id) on delete cascade,
  unit_id uuid references territory.units(id) on delete set null,
  kind text not null check (kind in ('social', 'service')),
  platform text,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  data_source text not null default 'scraped'
    check (data_source in ('seed', 'scraped', 'official')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_account_id, url)
);

create index if not exists idx_account_links_owner_kind
  on public.account_links (owner_account_id, kind, sort_order);

create index if not exists idx_account_links_unit_kind
  on public.account_links (unit_id, kind, sort_order)
  where unit_id is not null;

comment on table public.account_links is
  'Account-owned social and resident-task links. unit_id tags geography for /play.';

alter table public.account_links enable row level security;

drop policy if exists account_links_public_read on public.account_links;
create policy account_links_public_read on public.account_links
  for select
  using (true);

drop policy if exists account_links_member_insert on public.account_links;
create policy account_links_member_insert on public.account_links
  for insert to authenticated
  with check (public.is_account_member(owner_account_id));

drop policy if exists account_links_member_update on public.account_links;
create policy account_links_member_update on public.account_links
  for update to authenticated
  using (public.is_account_member(owner_account_id))
  with check (public.is_account_member(owner_account_id));

drop policy if exists account_links_member_delete on public.account_links;
create policy account_links_member_delete on public.account_links
  for delete to authenticated
  using (public.is_account_member(owner_account_id));

grant select on public.account_links to anon, authenticated;
grant insert, update, delete on public.account_links to authenticated;
grant all on public.account_links to service_role;
