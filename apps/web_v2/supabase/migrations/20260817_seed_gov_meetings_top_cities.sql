-- Seed verified civic profile data for Minnesota's 10 largest cities.
-- Factual fields only — sourced from each city's official website / council rules.
-- No fabricated meeting dates or agenda items. See apps/ios/supabase/seeds/README.md
--
-- Sources checked August 2026:
--   Minneapolis  → minneapolismn.gov, lims.minneapolismn.gov
--   Saint Paul   → stpaul.gov/meetings-agendas-and-minutes
--   Rochester    → rochestermn.gov council calendar PDF
--   Bloomington  → bloomingtonmn.gov council rules
--   Duluth       → duluthmn.gov standing rules
--   Brooklyn Park → brooklynpark.org council rules PDF
--   Plymouth     → plymouthmn.gov city council page
--   Woodbury     → woodburymn.gov mayor and city council
--   Maple Grove  → maplegrovemn.gov mayor and city council
--   St. Cloud    → ci.stcloud.mn.us city council, 2026 calendar PDF

-- ─── Resolve unit by CTU name (handles St. Paul / Saint Paul variants) ────────
create or replace function territory.resolve_ctu_unit(p_name text)
returns uuid
language sql
stable
as $$
  select id
  from territory.units
  where kind = 'ctu'
    and (
      lower(trim(name)) = lower(trim(p_name))
      or (
        p_name = 'Saint Paul'
        and lower(replace(replace(trim(name), '.', ''), '  ', ' ')) in ('st paul', 'saint paul')
      )
      or (
        p_name = 'St. Cloud'
        and lower(replace(replace(trim(name), '.', ''), '  ', ' ')) in ('st cloud', 'saint cloud')
      )
    )
  order by case when lower(trim(name)) = lower(trim(p_name)) then 0 else 1 end
  limit 1;
$$;

-- ─── Unit profiles: website, hall, verified schedule label ───────────────────
update territory.units u set
  website_url = coalesce(u.website_url, v.website),
  meeting_schedule_label = v.schedule_label,
  hall_name = coalesce(u.hall_name, v.hall_name),
  hall_address = coalesce(u.hall_address, v.hall_address),
  data_source = case when u.data_source = 'official' then u.data_source else 'scraped' end
from (values
  (
    'Minneapolis',
    'https://www.minneapolismn.gov',
    'Adopted council calendar (varies by term — see LIMS)',
    'Minneapolis City Hall',
    '350 S 5th St, Minneapolis, MN 55415'
  ),
  (
    'Saint Paul',
    'https://www.stpaul.gov',
    'Every Wednesday, 3:30 PM (except 5th Wednesday of the month)',
    'Saint Paul City Hall — Council Chambers',
    '15 Kellogg Blvd W, St Paul, MN 55102'
  ),
  (
    'Rochester',
    'https://www.rochestermn.gov',
    '1st & 3rd Monday, 6:00 PM (typical; see adopted calendar)',
    'Rochester City Hall — Council Chambers',
    '201 4th St SE, Rochester, MN 55904'
  ),
  (
    'Bloomington',
    'https://www.bloomingtonmn.gov',
    'Mondays, 6:30 PM (see approved council calendar)',
    'Bloomington Civic Plaza — Council Chambers',
    '1800 W Old Shakopee Rd, Bloomington, MN 55431'
  ),
  (
    'Duluth',
    'https://duluthmn.gov',
    '2nd & 4th Monday, 6:00 PM',
    'Duluth City Hall — Council Chambers',
    '411 W 1st St, Duluth, MN 55802'
  ),
  (
    'Brooklyn Park',
    'https://www.brooklynpark.org',
    '1st, 2nd & 4th Monday, 6:00 PM',
    'Brooklyn Park City Hall — Council Chambers',
    '5200 85th Ave N, Brooklyn Park, MN 55443'
  ),
  (
    'Plymouth',
    'https://www.plymouthmn.gov',
    '2nd & 4th Tuesday, 7:00 PM',
    'Plymouth City Hall — Council Chambers',
    '3400 Plymouth Blvd, Plymouth, MN 55447'
  ),
  (
    'Woodbury',
    'https://www.woodburymn.gov',
    '2nd & 4th Wednesday, 7:30 PM (see city calendar)',
    'Woodbury City Hall — Council Chambers',
    '8301 Valley Creek Rd, Woodbury, MN 55125'
  ),
  (
    'Maple Grove',
    'https://www.maplegrovemn.gov',
    '1st & 3rd Monday, 7:30 PM',
    'Maple Grove Government Center — Council Chambers',
    '12800 Arbor Lakes Parkway N, Maple Grove, MN 55369'
  ),
  (
    'St. Cloud',
    'https://www.ci.stcloud.mn.us',
    '6:00 PM, two Mondays per month (see 2026 council calendar)',
    'St. Cloud City Hall — Council Chambers',
    '1201 7th St S, St Cloud, MN 56301'
  )
) as v(name, website, schedule_label, hall_name, hall_address)
where u.id = territory.resolve_ctu_unit(v.name);

-- ─── Default meeting bodies + link to official meetings page ─────────────────
insert into territory.meeting_bodies (
  unit_id, name, cadence_label, default_location, default_virtual_url, data_source
)
select
  territory.resolve_ctu_unit(v.city_name),
  'City Council',
  v.cadence_label,
  v.default_location,
  v.meetings_url,
  'scraped'
from (values
  (
    'Minneapolis',
    'Adopted council calendar (varies by term — see LIMS)',
    'Minneapolis City Hall — Council Chambers',
    'https://lims.minneapolismn.gov/calendar/all/upcoming'
  ),
  (
    'Saint Paul',
    'Every Wednesday, 3:30 PM (except 5th Wednesday of the month)',
    'City Hall — Council Chambers, 3rd Floor',
    'https://www.stpaul.gov/meetings-agendas-and-minutes'
  ),
  (
    'Rochester',
    '1st & 3rd Monday, 6:00 PM (typical; see adopted calendar)',
    'City Hall — Council Chambers',
    'https://www.rochestermn.gov/council-administration/city-council/city-council-meetings/'
  ),
  (
    'Bloomington',
    'Mondays, 6:30 PM (see approved council calendar)',
    'Bloomington Civic Plaza — Council Chambers',
    'https://www.bloomingtonmn.gov/cc/city-council'
  ),
  (
    'Duluth',
    '2nd & 4th Monday, 6:00 PM',
    'City Hall — Council Chambers, 3rd Floor',
    'https://duluthmn.gov/city-council/city-council-meetings-events/meeting-schedule/'
  ),
  (
    'Brooklyn Park',
    '1st, 2nd & 4th Monday, 6:00 PM',
    'City Hall — Council Chambers',
    'https://www.brooklynpark.org/city-council/city-council-documents/'
  ),
  (
    'Plymouth',
    '2nd & 4th Tuesday, 7:00 PM',
    'Plymouth City Hall — Council Chambers',
    'https://www.plymouthmn.gov/departments/city-council/meetings-agendas-videos-2406'
  ),
  (
    'Woodbury',
    '2nd & 4th Wednesday, 7:30 PM (see city calendar)',
    'Woodbury City Hall — Council Chambers',
    'https://www.woodburymn.gov/agendacenter'
  ),
  (
    'Maple Grove',
    '1st & 3rd Monday, 7:30 PM',
    'Maple Grove Government Center — Council Chambers',
    'https://www.maplegrovemn.gov/AgendaCenter/City-Council-2'
  ),
  (
    'St. Cloud',
    '6:00 PM, two Mondays per month (see 2026 council calendar)',
    'City Hall — Council Chambers',
    'https://www.ci.stcloud.mn.us/81/City-Council'
  )
) as v(city_name, cadence_label, default_location, meetings_url)
where territory.resolve_ctu_unit(v.city_name) is not null
on conflict (unit_id, name) do update set
  cadence_label = excluded.cadence_label,
  default_location = excluded.default_location,
  default_virtual_url = excluded.default_virtual_url,
  data_source = excluded.data_source;

drop function if exists territory.resolve_ctu_unit(text);
