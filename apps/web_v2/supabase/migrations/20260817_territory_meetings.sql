-- Territory civic meetings — display layer for /play gov cards.
-- Seed-first: data_source tracks seed | scraped | official. Clerks override later.

-- ─── 1. Extend territory.units profile fields ─────────────────────────────────
alter table territory.units
  add column if not exists hall_name text,
  add column if not exists hall_address text,
  add column if not exists meeting_schedule_label text,
  add column if not exists data_source text not null default 'seed'
    check (data_source in ('seed', 'scraped', 'official')),
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id);

comment on column territory.units.meeting_schedule_label is
  'Human-readable recurring schedule, e.g. "1st & 3rd Friday, 9:30 AM".';
comment on column territory.units.data_source is
  'seed = bulk import; scraped = public record; official = clerk-verified.';

-- ─── 2. meeting_bodies ────────────────────────────────────────────────────────
create table if not exists territory.meeting_bodies (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references territory.units(id) on delete cascade,
  name text not null,
  cadence_label text,
  default_location text,
  default_virtual_url text,
  data_source text not null default 'seed'
    check (data_source in ('seed', 'scraped', 'official')),
  created_at timestamptz not null default now(),
  unique (unit_id, name)
);

create index if not exists idx_meeting_bodies_unit
  on territory.meeting_bodies (unit_id);

comment on table territory.meeting_bodies is
  'Default governing body per unit — City Council, County Board, etc.';

-- ─── 3. meetings ──────────────────────────────────────────────────────────────
create table if not exists territory.meetings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references territory.units(id) on delete cascade,
  body_id uuid references territory.meeting_bodies(id) on delete set null,
  title text not null,
  cadence text not null default 'one_off'
    check (cadence in ('one_off', 'recurring')),
  cadence_label text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_label text,
  virtual_url text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  external_agenda_url text,
  data_source text not null default 'seed'
    check (data_source in ('seed', 'scraped', 'official')),
  source_urls text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists idx_meetings_unit_starts
  on territory.meetings (unit_id, starts_at desc);

create index if not exists idx_meetings_upcoming
  on territory.meetings (starts_at)
  where status = 'scheduled';

comment on table territory.meetings is
  'Scheduled or past civic meetings for a territory unit.';

-- ─── 4. agenda_items ──────────────────────────────────────────────────────────
create table if not exists territory.agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references territory.meetings(id) on delete cascade,
  sort_order int not null,
  title text not null,
  summary text,
  presenter text,
  status text not null default 'pending'
    check (status in ('pending', 'discussed', 'tabled', 'voted')),
  is_public_hearing boolean not null default false,
  data_source text not null default 'seed'
    check (data_source in ('seed', 'scraped', 'official')),
  unique (meeting_id, sort_order)
);

create index if not exists idx_agenda_items_meeting
  on territory.agenda_items (meeting_id, sort_order);

-- ─── 5. meeting_resources ─────────────────────────────────────────────────────
create table if not exists territory.meeting_resources (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references territory.meetings(id) on delete cascade,
  agenda_item_id uuid references territory.agenda_items(id) on delete set null,
  kind text not null
    check (kind in ('packet', 'minutes', 'recording', 'attachment', 'link')),
  title text not null,
  url text not null,
  data_source text not null default 'seed'
    check (data_source in ('seed', 'scraped', 'official'))
);

create index if not exists idx_meeting_resources_meeting
  on territory.meeting_resources (meeting_id);

-- ─── 6. unit_managers (official claim path — phase 2) ─────────────────────────
create table if not exists territory.unit_managers (
  unit_id uuid not null references territory.units(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'clerk'
    check (role in ('clerk', 'admin')),
  claimed_at timestamptz not null default now(),
  primary key (unit_id, user_id)
);

create index if not exists idx_unit_managers_user
  on territory.unit_managers (user_id);

-- ─── 7. RLS — public read for civic display data ─────────────────────────────
alter table territory.meeting_bodies enable row level security;
alter table territory.meetings enable row level security;
alter table territory.agenda_items enable row level security;
alter table territory.meeting_resources enable row level security;
alter table territory.unit_managers enable row level security;

drop policy if exists meeting_bodies_public_read on territory.meeting_bodies;
create policy meeting_bodies_public_read on territory.meeting_bodies
  for select using (true);

drop policy if exists meetings_public_read on territory.meetings;
create policy meetings_public_read on territory.meetings
  for select using (true);

drop policy if exists agenda_items_public_read on territory.agenda_items;
create policy agenda_items_public_read on territory.agenda_items
  for select using (true);

drop policy if exists meeting_resources_public_read on territory.meeting_resources;
create policy meeting_resources_public_read on territory.meeting_resources
  for select using (true);

-- Managers readable by the manager themselves; writes via service role / future clerk API.
drop policy if exists unit_managers_self_read on territory.unit_managers;
create policy unit_managers_self_read on territory.unit_managers
  for select using (auth.uid() = user_id);
