-- Phase 0 Batch A (0.1–0.9): account ownership spine + meetings + RLS.
-- Additive only. Rollback unit = this migration (drop new objects / null new cols).

-- ─── 0.1 account_type + claim_status ─────────────────────────────────────────
alter table public.accounts
  drop constraint if exists accounts_account_type_check;

alter table public.accounts
  add constraint accounts_account_type_check
  check (
    account_type is null
    or account_type = any (array['resident', 'business', 'government', 'org']::text[])
  );

alter table public.accounts
  add column if not exists claim_status text;

alter table public.accounts
  add column if not exists claimed_at timestamptz;

alter table public.accounts
  add column if not exists claimed_by_account_id uuid references public.accounts(id);

update public.accounts
set claim_status = 'unclaimed'
where claim_status is null
  and account_type = 'government';

alter table public.accounts
  drop constraint if exists accounts_claim_status_check;

alter table public.accounts
  add constraint accounts_claim_status_check
  check (
    claim_status is null
    or claim_status = any (array['unclaimed', 'pending', 'claimed']::text[])
  );

comment on column public.accounts.claim_status is
  'Government/org claim state. null for residents/businesses that do not use claim.';

-- ─── 0.2 publisher accounts → government ─────────────────────────────────────
update public.accounts a
set
  account_type = 'government',
  claim_status = coalesce(a.claim_status, 'unclaimed')
where a.id in (
  select publisher_account_id
  from admin.territories
  where publisher_account_id is not null
);

-- ─── 0.3 units.owner_account_id ───────────────────────────────────────────────
alter table territory.units
  add column if not exists owner_account_id uuid references public.accounts(id);

create unique index if not exists units_owner_account_id_uidx
  on territory.units (owner_account_id)
  where owner_account_id is not null;

create unique index if not exists units_one_owner_per_unit_uidx
  on territory.units (id)
  where owner_account_id is not null;

-- Enforce government-only owners
create or replace function territory.enforce_unit_owner_is_government()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.owner_account_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.accounts a
    where a.id = new.owner_account_id
      and a.account_type = 'government'
  ) then
    raise exception 'territory.units.owner_account_id must reference a government account';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_units_owner_government on territory.units;
create trigger trg_units_owner_government
  before insert or update of owner_account_id on territory.units
  for each row
  execute function territory.enforce_unit_owner_is_government();

comment on column territory.units.owner_account_id is
  'Government account that owns civic write rights for this unit (1:1).';

-- ─── 0.4 ownership backfill via admin.territories.city_id ─────────────────────
update territory.units u
set owner_account_id = t.publisher_account_id
from admin.territories t
where t.city_id = u.id
  and t.publisher_account_id is not null
  and u.owner_account_id is distinct from t.publisher_account_id;

-- Fail loudly if any publisher city_id did not resolve
do $$
declare
  missing int;
begin
  select count(*) into missing
  from admin.territories t
  where t.publisher_account_id is not null
    and (
      t.city_id is null
      or not exists (
        select 1 from territory.units u
        where u.id = t.city_id
          and u.owner_account_id = t.publisher_account_id
      )
    );
  if missing > 0 then
    raise exception 'Phase 0 ownership backfill incomplete for % publisher territories', missing;
  end if;
end $$;

-- ─── 0.5 account_members ──────────────────────────────────────────────────────
create table if not exists public.account_members (
  org_account_id uuid not null references public.accounts(id) on delete cascade,
  person_account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_account_id, person_account_id)
);

create index if not exists idx_account_members_person
  on public.account_members (person_account_id);

comment on table public.account_members is
  'Person accounts that can act as an org account (government/business). No roles in Phase 0.';

alter table public.account_members enable row level security;

-- ─── 0.6 staff → members of unclaimed government accounts ─────────────────────
insert into public.account_members (org_account_id, person_account_id)
select t.publisher_account_id, s.account_id
from admin.territories t
cross join admin.staff s
where t.publisher_account_id is not null
  and s.status = 'active'
  and s.account_id is not null
on conflict do nothing;

-- ─── 0.7 is_account_member() ──────────────────────────────────────────────────
create or replace function public.is_account_member(p_org_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.account_members m
    join public.accounts person on person.id = m.person_account_id
    where m.org_account_id = p_org_account_id
      and person.user_id = auth.uid()
  );
$$;

revoke all on function public.is_account_member(uuid) from public;
grant execute on function public.is_account_member(uuid) to authenticated;
grant execute on function public.is_account_member(uuid) to service_role;

comment on function public.is_account_member(uuid) is
  'True when auth.uid() has a person account that is a member of the org account.';

-- Members RLS: see memberships for orgs you belong to, or your own person rows
drop policy if exists account_members_select_own on public.account_members;
create policy account_members_select_own on public.account_members
  for select to authenticated
  using (
    public.is_account_member(org_account_id)
    or exists (
      select 1 from public.accounts a
      where a.id = person_account_id
        and a.user_id = auth.uid()
    )
    or public.is_app_admin()
  );

-- Writes managed by service role / claim RPC in Phase 0
drop policy if exists account_members_service_insert on public.account_members;
-- no authenticated insert/update/delete policies — service_role + claim RPC only

-- ─── 0.8 public.meetings ──────────────────────────────────────────────────────
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.accounts(id) on delete cascade,
  unit_id uuid references territory.units(id) on delete set null,
  title text not null,
  body_name text not null default 'City Council',
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
  legacy_local_gov_meeting_id uuid,
  created_at timestamptz not null default now(),
  unique (legacy_local_gov_meeting_id)
);

create index if not exists idx_public_meetings_owner_starts
  on public.meetings (owner_account_id, starts_at desc);

create index if not exists idx_public_meetings_unit_starts
  on public.meetings (unit_id, starts_at desc)
  where unit_id is not null;

create index if not exists idx_public_meetings_upcoming
  on public.meetings (starts_at)
  where status = 'scheduled';

comment on table public.meetings is
  'Account-owned civic/business meetings. unit_id tags geography for /play.';

-- ─── 0.9 RLS on meetings ──────────────────────────────────────────────────────
alter table public.meetings enable row level security;

drop policy if exists meetings_public_read on public.meetings;
create policy meetings_public_read on public.meetings
  for select
  using (true);

drop policy if exists meetings_member_insert on public.meetings;
create policy meetings_member_insert on public.meetings
  for insert to authenticated
  with check (public.is_account_member(owner_account_id));

drop policy if exists meetings_member_update on public.meetings;
create policy meetings_member_update on public.meetings
  for update to authenticated
  using (public.is_account_member(owner_account_id))
  with check (public.is_account_member(owner_account_id));

drop policy if exists meetings_member_delete on public.meetings;
create policy meetings_member_delete on public.meetings
  for delete to authenticated
  using (public.is_account_member(owner_account_id));

grant select on public.meetings to anon, authenticated;
grant insert, update, delete on public.meetings to authenticated;
grant all on public.meetings to service_role;

grant select on public.account_members to authenticated;
grant all on public.account_members to service_role;
