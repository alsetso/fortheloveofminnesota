-- Curated primary nav for /play Resources. Archive nav_nodes stay positional
-- crawl truth; this is the publisher-owned tree staff can rename, hide, or delete.
-- Recrawl must not stomp curated labels.

create table if not exists public.account_nav (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.accounts(id) on delete cascade,
  unit_id uuid references territory.units(id) on delete set null,
  parent_id uuid references public.account_nav(id) on delete cascade,
  label text not null,
  url text,
  sort_order integer not null default 0,
  hidden boolean not null default false,
  data_source text not null default 'scraped'
    check (data_source in ('seed', 'scraped', 'official')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_nav_owner_url
  on public.account_nav (owner_account_id, url)
  where url is not null;

create index if not exists idx_account_nav_owner_parent
  on public.account_nav (owner_account_id, parent_id, sort_order);

comment on table public.account_nav is
  'Publisher-owned website map (primary nav). /play Resources reads this tree.';

alter table public.account_nav enable row level security;

drop policy if exists account_nav_public_read on public.account_nav;
create policy account_nav_public_read on public.account_nav
  for select
  using (true);

drop policy if exists account_nav_member_insert on public.account_nav;
create policy account_nav_member_insert on public.account_nav
  for insert to authenticated
  with check (public.is_account_member(owner_account_id));

drop policy if exists account_nav_member_update on public.account_nav;
create policy account_nav_member_update on public.account_nav
  for update to authenticated
  using (public.is_account_member(owner_account_id))
  with check (public.is_account_member(owner_account_id));

drop policy if exists account_nav_member_delete on public.account_nav;
create policy account_nav_member_delete on public.account_nav
  for delete to authenticated
  using (public.is_account_member(owner_account_id));

grant select on public.account_nav to anon, authenticated;
grant insert, update, delete on public.account_nav to authenticated;
grant all on public.account_nav to service_role;

alter table public.account_media
  add column if not exists hidden boolean not null default false;
