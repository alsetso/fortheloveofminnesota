-- Seed first 5 Minnesota Senators from senate.md
-- This is a template for the full 67 senators

-- ============================================================================
-- STEP 1: Insert people (senators)
-- ============================================================================

INSERT INTO civic.people (name, party, district, email, phone, address, slug)
VALUES
  -- 1. Abeler
  (
    'Jim Abeler',
    'R',
    '35',
    'sen.jim.abeler@mnsenate.gov',
    '651-296-3733',
    '2207 Minnesota Senate Bldg., St. Paul, MN 55155',
    'jim-abeler'
  ),
  -- 2. Bahr
  (
    'Andrew Bahr',
    'R',
    '31',
    NULL, -- Uses email form
    '651-296-3219',
    '2415 Minnesota Senate Bldg., St. Paul, MN 55155',
    'andrew-bahr'
  ),
  -- 3. Boldon
  (
    'Liz Boldon',
    'DFL',
    '25',
    NULL, -- Uses email form
    '651-296-3903',
    '3205 Minnesota Senate Bldg., St. Paul, MN 55155',
    'liz-boldon'
  ),
  -- 4. Carlson
  (
    'Jim Carlson',
    'DFL',
    '52',
    NULL, -- Uses email form
    '651-297-8073',
    '3221 Minnesota Senate Bldg., St. Paul, MN 55155',
    'jim-carlson'
  ),
  -- 5. Champion
  (
    'Bobby Joe Champion',
    'DFL',
    '59',
    'sen.bobby.champion@mnsenate.gov',
    '651-296-9246',
    '3401 Minnesota Senate Bldg., St. Paul, MN 55155',
    'bobby-joe-champion'
  ),
  -- 6. Clark
  (
    'Doron Clark',
    'DFL',
    '60',
    'sen.doron.clark@mnsenate.gov',
    '651-296-7809',
    '3403 Minnesota Senate Bldg., St. Paul, MN 55155',
    'doron-clark'
  ),
  -- 7. Coleman
  (
    'Julia Coleman',
    'R',
    '48',
    'sen.julia.coleman@mnsenate.gov',
    '651-296-4837',
    '2303 Minnesota Senate Bldg., St. Paul, MN 55155',
    'julia-coleman'
  ),
  -- 8. Cwodzinski
  (
    'Steve A. Cwodzinski',
    'DFL',
    '49',
    NULL, -- Uses email form
    '651-296-1314',
    '3207 Minnesota Senate Bldg., St. Paul, MN 55155',
    'steve-cwodzinski'
  ),
  -- 9. Dahms
  (
    'Gary Dahms',
    'R',
    '15',
    'sen.gary.dahms@mnsenate.gov',
    '651-296-8138',
    '2219 Minnesota Senate Bldg., St. Paul, MN 55155',
    'gary-dahms'
  ),
  -- 10. Dibble
  (
    'D. Scott Dibble',
    'DFL',
    '61',
    NULL, -- Uses email form
    '651-296-4191',
    '3107 Minnesota Senate Bldg., St. Paul, MN 55155',
    'scott-dibble'
  ),
  -- 11. Dornink
  (
    'Gene Dornink',
    'R',
    '23',
    'sen.gene.dornink@mnsenate.gov',
    '651-296-5240',
    '3411 Minnesota Senate Bldg., St. Paul, MN 55155',
    'gene-dornink'
  ),
  -- 12. Draheim
  (
    'Rich Draheim',
    'R',
    '22',
    'sen.rich.draheim@mnsenate.gov',
    '651-296-5558',
    '2225 Minnesota Senate Bldg., St. Paul, MN 55155',
    'rich-draheim'
  ),
  -- 13. Drazkowski
  (
    'Steve Drazkowski',
    'R',
    '20',
    NULL, -- Uses email form
    '651-296-5612',
    '2411 Minnesota Senate Bldg., St. Paul, MN 55155',
    'steve-drazkowski'
  ),
  -- 14. Duckworth
  (
    'Glenn Duckworth',
    'R',
    '57',
    NULL, -- Uses email form
    '651-296-7633',
    '2229 Minnesota Senate Bldg., St. Paul, MN 55155',
    'glenn-duckworth'
  ),
  -- 15. Farnsworth
  (
    'Justin Farnsworth',
    'R',
    '07',
    NULL, -- Uses email form
    '651-296-8436',
    '2323 Minnesota Senate Bldg., St. Paul, MN 55155',
    'justin-farnsworth'
  )
ON CONFLICT (slug) DO UPDATE SET
  district = EXCLUDED.district,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  party = EXCLUDED.party;

-- ============================================================================
-- STEP 2: Insert roles (senator positions)
-- ============================================================================

-- Get the Minnesota Senate org ID
WITH senate_org AS (
  SELECT id FROM civic.orgs WHERE slug = 'mn-senate'
),
senator_people AS (
  SELECT id, name FROM civic.people WHERE slug IN (
    'jim-abeler', 'andrew-bahr', 'liz-boldon', 'jim-carlson', 'bobby-joe-champion',
    'doron-clark', 'julia-coleman', 'steve-cwodzinski', 'gary-dahms', 'scott-dibble',
    'gene-dornink', 'rich-draheim', 'steve-drazkowski', 'glenn-duckworth', 'justin-farnsworth'
  )
)
INSERT INTO civic.roles (person_id, org_id, title, is_current)
SELECT 
  sp.id,
  so.id,
  CASE 
    WHEN sp.name = 'Bobby Joe Champion' THEN 'President of the Senate'
    WHEN sp.name = 'Liz Boldon' THEN 'Assistant Majority Leader'
    WHEN sp.name = 'Julia Coleman' THEN 'Assistant Minority Leader'
    WHEN sp.name = 'Gary Dahms' THEN 'Assistant Minority Leader'
    ELSE 'Senator'
  END,
  true
FROM senator_people sp
CROSS JOIN senate_org so
WHERE NOT EXISTS (
  SELECT 1 FROM civic.roles r 
  WHERE r.person_id = sp.id 
    AND r.org_id = so.id 
    AND r.is_current = true
);

