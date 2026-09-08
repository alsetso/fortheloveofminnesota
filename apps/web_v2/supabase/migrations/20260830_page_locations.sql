-- Multi-location support for directory pages.
-- pages.lat/lng/address_line remain the denormalized primary pin for map/list.
-- page.locations holds the primary row (is_primary) plus additional locations later.

create table if not exists page.locations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references page.pages(id) on delete cascade,
  label text,
  address_line text,
  lat double precision not null,
  lng double precision not null,
  home_based boolean not null default false,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  city_id uuid references territory.units(id) on delete set null,
  county_id uuid references territory.units(id) on delete set null,
  unit_id uuid references territory.units(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_locations_lat_range check (lat >= -90 and lat <= 90),
  constraint page_locations_lng_range check (lng >= -180 and lng <= 180)
);

create index if not exists idx_page_locations_page_id
  on page.locations (page_id, sort_order, created_at);

create index if not exists idx_page_locations_page_primary
  on page.locations (page_id)
  where is_primary;

create unique index if not exists page_locations_one_primary_per_page
  on page.locations (page_id)
  where is_primary;

comment on table page.locations is
  'Page pin(s). is_primary mirrors pages.lat/lng/address_line for the default address.';

alter table page.locations enable row level security;

drop policy if exists page_locations_public_read on page.locations;
create policy page_locations_public_read on page.locations
  for select
  using (true);

grant select on page.locations to anon, authenticated;
grant all on page.locations to service_role;

insert into page.locations (
  page_id,
  address_line,
  lat,
  lng,
  home_based,
  is_primary,
  sort_order,
  city_id,
  county_id,
  unit_id
)
select
  p.id,
  nullif(trim(p.address_line), ''),
  p.lat,
  p.lng,
  coalesce(p.home_based, false),
  true,
  0,
  p.city_id,
  p.county_id,
  p.unit_id
from page.pages p
where p.lat is not null
  and p.lng is not null
  and not exists (
    select 1 from page.locations l
    where l.page_id = p.id and l.is_primary
  );
