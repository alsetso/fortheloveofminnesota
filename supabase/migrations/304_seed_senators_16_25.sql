-- Seed Minnesota Senators 16-25 from senate.md

-- ============================================================================
-- STEP 1: Insert people (senators 16-25)
-- ============================================================================

INSERT INTO civic.people (name, party, district, email, phone, address, slug)
VALUES
  -- 16. Fateh
  (
    'Omar Fateh',
    'DFL',
    '62',
    NULL, -- Uses email form
    '651-296-4261',
    '3219 Minnesota Senate Bldg., St. Paul, MN 55155',
    'omar-fateh'
  ),
  -- 17. Frentz
  (
    'Nick A. Frentz',
    'DFL',
    '18',
    NULL, -- Uses email form
    '651-296-6153',
    '3109 Minnesota Senate Bldg., St. Paul, MN 55155',
    'nick-frentz'
  ),
  -- 18. Green
  (
    'Steve Green',
    'R',
    '02',
    'sen.steve.green@mnsenate.gov',
    '651-297-8063',
    '2319 Minnesota Senate Bldg., St. Paul, MN 55155',
    'steve-green'
  ),
  -- 19. Gruenhagen
  (
    'Glenn Gruenhagen',
    'R',
    '17',
    'sen.glenn.gruenhagen@mnsenate.gov',
    '651-296-4131',
    '2417 Minnesota Senate Bldg., St. Paul, MN 55155',
    'glenn-gruenhagen'
  ),
  -- 20. Gustafson
  (
    'Heather Gustafson',
    'DFL',
    '36',
    NULL, -- Uses email form
    '651-296-1253',
    '3103 Minnesota Senate Bldg., St. Paul, MN 55155',
    'heather-gustafson'
  ),
  -- 21. Hauschild
  (
    'Grant Hauschild',
    'DFL',
    '03',
    NULL, -- Uses email form
    '651-296-1789',
    '3111 Minnesota Senate Bldg., St. Paul, MN 55155',
    'grant-hauschild'
  ),
  -- 22. Hawj
  (
    'Foung Hawj',
    'DFL',
    '67',
    NULL, -- Uses email form
    '651-296-5285',
    '3231 Minnesota Senate Bldg., St. Paul, MN 55155',
    'foung-hawj'
  ),
  -- 23. Heintzeman
  (
    'Josh Heintzeman',
    'R',
    '06',
    NULL, -- Uses email form
    '651-296-7079',
    '2235 Minnesota Senate Bldg., St. Paul, MN 55155',
    'josh-heintzeman'
  ),
  -- 24. Hemmingsen-Jaeger
  (
    'Amanda H. Hemmingsen-Jaeger',
    'DFL',
    '47',
    NULL, -- Uses email form
    '651-296-5537',
    '3000 Minnesota Senate Bldg., St. Paul, MN 55155',
    'amanda-hemmingsen-jaeger'
  ),
  -- 25. Hoffman
  (
    'John A. Hoffman',
    'DFL',
    '34',
    NULL, -- Uses email form
    '651-296-4154',
    '2111 Minnesota Senate Bldg., St. Paul, MN 55155',
    'john-hoffman'
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
    'omar-fateh', 'nick-frentz', 'steve-green', 'glenn-gruenhagen', 'heather-gustafson',
    'grant-hauschild', 'foung-hawj', 'josh-heintzeman', 'amanda-hemmingsen-jaeger', 'john-hoffman'
  )
)
INSERT INTO civic.roles (person_id, org_id, title, is_current)
SELECT 
  sp.id,
  so.id,
  CASE 
    WHEN sp.name = 'Nick A. Frentz' THEN 'Assistant Majority Leader'
    WHEN sp.name = 'Grant Hauschild' THEN 'Assistant Majority Leader'
    WHEN sp.name = 'Foung Hawj' THEN 'Assistant Majority Leader'
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

