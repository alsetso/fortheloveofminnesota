-- Phase 0 Batch B (0.10): migrate local_gov.meetings → public.meetings.
-- Rollback unit: DELETE FROM public.meetings WHERE legacy_local_gov_meeting_id IS NOT NULL;
-- Does not drop or mutate local_gov.meetings.

insert into public.meetings (
  owner_account_id,
  unit_id,
  title,
  body_name,
  cadence,
  starts_at,
  status,
  data_source,
  legacy_local_gov_meeting_id
)
select
  u.owner_account_id,
  r.city_id,
  m.title,
  'City Council',
  'one_off',
  m.starts_at,
  'scheduled',
  'scraped',
  m.id
from local_gov.meetings m
join local_gov.records r on r.id = m.record_id
join territory.units u on u.id = r.city_id
where u.owner_account_id is not null
  and m.starts_at is not null
on conflict (legacy_local_gov_meeting_id) do update set
  owner_account_id = excluded.owner_account_id,
  unit_id = excluded.unit_id,
  title = excluded.title,
  starts_at = excluded.starts_at,
  data_source = excluded.data_source;
