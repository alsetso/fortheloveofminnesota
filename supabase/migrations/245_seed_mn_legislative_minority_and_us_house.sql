-- Seed Minnesota legislative minority leaders and US House Representatives
-- Ranks 11-20 in Minnesota political influence

-- ============================================================================
-- STEP 1: Create additional positions
-- ============================================================================

INSERT INTO civic.positions (title, slug, branch, level, authority_rank) VALUES
-- Legislative minority leadership
('Senate Minority Leader', 'senate-minority-leader', 'Legislative', 'State', 2),
('House Minority Leader', 'house-minority-leader', 'Legislative', 'State', 2),
('House DFL Caucus Leader', 'house-dfl-caucus-leader', 'Legislative', 'State', 2),
-- Federal House
('U.S. Representative', 'us-representative', 'Legislative', 'Federal', 2),
('House Majority Whip', 'house-majority-whip', 'Legislative', 'Federal', 1)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 2: Create leader records - Legislative Minority
-- ============================================================================

-- Mark Johnson - Senate Minority Leader
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Mark Johnson', 'mark-johnson', 'Republican', true, 'https://www.senate.mn/members/member_bio.html?mem_id=1246')
ON CONFLICT (slug) DO NOTHING;

-- Zack Stephenson - House DFL Caucus Leader
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Zack Stephenson', 'zack-stephenson', 'DFL', true, 'https://www.house.leg.state.mn.us/members/profile/15536')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 3: Create leader records - US House Representatives
-- ============================================================================

-- MN-01: Brad Finstad (R)
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Brad Finstad', 'brad-finstad', 'Republican', true, 'https://finstad.house.gov/')
ON CONFLICT (slug) DO NOTHING;

-- MN-02: Angie Craig (DFL)
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Angie Craig', 'angie-craig', 'DFL', true, 'https://craig.house.gov/')
ON CONFLICT (slug) DO NOTHING;

-- MN-03: Kelly Morrison (DFL) - new in 2025
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Kelly Morrison', 'kelly-morrison', 'DFL', true, 'https://morrison.house.gov/')
ON CONFLICT (slug) DO NOTHING;

-- MN-04: Betty McCollum (DFL) - most senior since 2001
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Betty McCollum', 'betty-mccollum', 'DFL', true, 'https://mccollum.house.gov/')
ON CONFLICT (slug) DO NOTHING;

-- MN-05: Ilhan Omar (DFL)
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Ilhan Omar', 'ilhan-omar', 'DFL', true, 'https://omar.house.gov/')
ON CONFLICT (slug) DO NOTHING;

-- MN-06: Tom Emmer (R) - House Majority Whip
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Tom Emmer', 'tom-emmer', 'Republican', true, 'https://emmer.house.gov/')
ON CONFLICT (slug) DO NOTHING;

-- MN-07: Michelle Fischbach (R)
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Michelle Fischbach', 'michelle-fischbach', 'Republican', true, 'https://fischbach.house.gov/')
ON CONFLICT (slug) DO NOTHING;

-- MN-08: Pete Stauber (R)
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Pete Stauber', 'pete-stauber', 'Republican', true, 'https://stauber.house.gov/')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 4: Create terms - Legislative Minority Leaders
-- ============================================================================

-- Mark Johnson - Senate Minority Leader
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-02-03'::date,
  NULL,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'mark-johnson'
  AND p.slug = 'senate-minority-leader'
  AND j.slug = 'mn-senate';

-- Zack Stephenson - House DFL Caucus Leader
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-06-01'::date,
  NULL,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'zack-stephenson'
  AND p.slug = 'house-dfl-caucus-leader'
  AND j.slug = 'mn-house';

-- ============================================================================
-- STEP 5: Create terms - US House Representatives (119th Congress: 2025-2027)
-- ============================================================================

-- MN-01: Brad Finstad
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-03'::date,
  '2027-01-03'::date,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'brad-finstad'
  AND p.slug = 'us-representative'
  AND j.slug = 'mn-01';

-- MN-02: Angie Craig
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-03'::date,
  '2027-01-03'::date,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'angie-craig'
  AND p.slug = 'us-representative'
  AND j.slug = 'mn-02';

-- MN-03: Kelly Morrison
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-03'::date,
  '2027-01-03'::date,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'kelly-morrison'
  AND p.slug = 'us-representative'
  AND j.slug = 'mn-03';

-- MN-04: Betty McCollum
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-03'::date,
  '2027-01-03'::date,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'betty-mccollum'
  AND p.slug = 'us-representative'
  AND j.slug = 'mn-04';

-- MN-05: Ilhan Omar
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-03'::date,
  '2027-01-03'::date,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'ilhan-omar'
  AND p.slug = 'us-representative'
  AND j.slug = 'mn-05';

-- MN-06: Tom Emmer (also House Majority Whip)
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-03'::date,
  '2027-01-03'::date,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'tom-emmer'
  AND p.slug = 'us-representative'
  AND j.slug = 'mn-06';

-- Tom Emmer - House Majority Whip (additional federal leadership role)
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2023-10-25'::date,  -- Elected Majority Whip
  NULL,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'tom-emmer'
  AND p.slug = 'house-majority-whip'
  AND j.slug = 'united-states';

-- MN-07: Michelle Fischbach
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-03'::date,
  '2027-01-03'::date,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'michelle-fischbach'
  AND p.slug = 'us-representative'
  AND j.slug = 'mn-07';

-- MN-08: Pete Stauber
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-03'::date,
  '2027-01-03'::date,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'pete-stauber'
  AND p.slug = 'us-representative'
  AND j.slug = 'mn-08';


