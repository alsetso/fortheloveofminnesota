# Territory gov meeting seeds

Bulk civic data for `/play` gov cards. **Only verified facts** — no fabricated meeting dates or agenda items.

## Current scope: top 10 cities only

Migration `20260817_seed_gov_meetings_top_cities.sql` seeds:

1. Minneapolis
2. Saint Paul
3. Rochester
4. Bloomington
5. Duluth
6. Brooklyn Park
7. Plymouth
8. Woodbury
9. Maple Grove
10. St. Cloud

### What gets seeded (factual)

| Field | Source |
|---|---|
| `website_url` | Official `.gov` domain |
| `meeting_schedule_label` | Council rules / standing rules / council page |
| `hall_name`, `hall_address` | Official city hall address (also copied into `prominent_locations`) |
| `prominent_locations` | Civic landmarks — halls, courthouses, service centers |

### What is NOT seeded

- Individual `territory.meetings` rows with invented dates
- `agenda_items` (generic placeholders)
- Counties (Hennepin, Ramsey, etc.)

Meetings section stays empty until real occurrences are imported from Legistar/LIMS/calendar feeds.

## Verified schedule reference (August 2026)

| City | Schedule (from official sources) |
|---|---|
| Minneapolis | Adopted calendar per term — no fixed weekday; see [LIMS calendar](https://lims.minneapolismn.gov/calendar/all/upcoming) |
| Saint Paul | Every Wednesday, 3:30 PM (except 5th Wednesday) |
| Rochester | Typically 1st & 3rd Monday, 6:00 PM |
| Bloomington | Mondays, 6:30 PM (approved annual calendar) |
| Duluth | 2nd & 4th Monday, 6:00 PM |
| Brooklyn Park | 1st, 2nd & 4th Monday, 6:00 PM |
| Plymouth | 2nd & 4th Tuesday, 7:00 PM |
| Woodbury | 2nd & 4th Wednesday, 7:30 PM |
| Maple Grove | 1st & 3rd Monday, 7:30 PM |
| St. Cloud | 6:00 PM, two Mondays/month per adopted 2026 calendar |

## Adding a city

1. Verify schedule on the city's official council page (do not guess).
2. Add a row to the profile `update` in the seed migration, and a matching `prominent_locations` pin if the hall is known.
3. Match `territory.units.name` exactly (check with `select id, name from territory.units where kind = 'ctu' and name ilike '%Foo%'`).

## Official override path

When a clerk claims a unit:

```sql
insert into territory.unit_managers (unit_id, user_id, role)
values (:unit_id, auth.uid(), 'clerk');

update territory.units set data_source = 'official', verified_at = now(), verified_by = auth.uid()
where id = :unit_id;
```

## Next: real meeting occurrences

Import from official calendar APIs (Legistar, Granicus, LIMS) into `territory.meetings` with real `starts_at` timestamps and `external_agenda_url`. Do not synthesize dates with `now() + interval`.
