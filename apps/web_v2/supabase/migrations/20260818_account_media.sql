-- Publisher-owned media for /play government cards.
-- YouTube videos crawled from the official channel. Archive stays off territory.units.

create table if not exists public.account_media (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.accounts(id) on delete cascade,
  unit_id uuid references territory.units(id) on delete set null,
  platform text not null check (platform in ('youtube')),
  external_id text not null,
  title text not null,
  url text not null,
  thumbnail_url text,
  published_at timestamptz,
  sort_order integer not null default 0,
  data_source text not null default 'scraped'
    check (data_source in ('seed', 'scraped', 'official')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_account_id, platform, external_id)
);

create index if not exists idx_account_media_owner_published
  on public.account_media (owner_account_id, platform, published_at desc nulls last);

create index if not exists idx_account_media_unit_published
  on public.account_media (unit_id, platform, published_at desc nulls last)
  where unit_id is not null;

comment on table public.account_media is
  'Account-owned videos and similar media. unit_id tags geography for /play.';

alter table public.account_media enable row level security;

drop policy if exists account_media_public_read on public.account_media;
create policy account_media_public_read on public.account_media
  for select
  using (true);

drop policy if exists account_media_member_insert on public.account_media;
create policy account_media_member_insert on public.account_media
  for insert to authenticated
  with check (public.is_account_member(owner_account_id));

drop policy if exists account_media_member_update on public.account_media;
create policy account_media_member_update on public.account_media
  for update to authenticated
  using (public.is_account_member(owner_account_id))
  with check (public.is_account_member(owner_account_id));

drop policy if exists account_media_member_delete on public.account_media;
create policy account_media_member_delete on public.account_media
  for delete to authenticated
  using (public.is_account_member(owner_account_id));

grant select on public.account_media to anon, authenticated;
grant insert, update, delete on public.account_media to authenticated;
grant all on public.account_media to service_role;
