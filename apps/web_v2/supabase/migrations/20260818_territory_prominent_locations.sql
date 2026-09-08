-- Curated civic landmarks for a territory unit (halls, courthouses, service centers).
-- Replaces territory.meeting_bodies as the place-of-government model.

create table if not exists territory.prominent_locations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references territory.units(id) on delete cascade,
  name text not null,
  description text,
  address text,
  lat double precision,
  lng double precision,
  location geography(Point, 4326)
    generated always as (
      case
        when lat is not null and lng is not null
          then ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      end
    ) stored,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, name)
);

create index if not exists idx_prominent_locations_unit
  on territory.prominent_locations (unit_id, sort_order, name);

create index if not exists idx_prominent_locations_geo
  on territory.prominent_locations using gist (location);

comment on table territory.prominent_locations is
  'Curated civic landmarks for a territory unit — halls, courthouses, service centers.';

comment on column territory.prominent_locations.location is
  'Generated Point from lng/lat. Null when coordinates are incomplete.';

alter table territory.prominent_locations enable row level security;

drop policy if exists prominent_locations_public_read on territory.prominent_locations;
create policy prominent_locations_public_read on territory.prominent_locations
  for select
  using (true);

grant select on territory.prominent_locations to anon, authenticated;
grant all on territory.prominent_locations to service_role;

-- Existing hall fields become the first pin so /play stays populated.
insert into territory.prominent_locations (unit_id, name, address, sort_order)
select
  u.id,
  coalesce(nullif(btrim(u.hall_name), ''), u.name || ' Hall'),
  nullif(btrim(u.hall_address), ''),
  0
from territory.units u
where nullif(btrim(u.hall_name), '') is not null
   or nullif(btrim(u.hall_address), '') is not null
on conflict (unit_id, name) do nothing;

-- meeting_bodies is unused as a product surface. Meetings keep body_name as free text.
alter table territory.meetings drop constraint if exists meetings_body_id_fkey;
alter table territory.meetings drop column if exists body_id;
drop policy if exists meeting_bodies_public_read on territory.meeting_bodies;
drop table if exists territory.meeting_bodies;
