-- Seed Minnesota federal, judicial, and legislative leaders
-- US Senators, Chief Justice, Senate Majority Leader, House Speaker

-- ============================================================================
-- STEP 1: Create additional positions
-- ============================================================================

INSERT INTO civic.positions (title, slug, branch, level, authority_rank) VALUES
-- Federal
('U.S. Senator', 'us-senator', 'Legislative', 'Federal', 1),
-- Judicial
('Chief Justice', 'chief-justice', 'Judicial', 'State', 1),
-- Legislative leadership
('Senate Majority Leader', 'senate-majority-leader', 'Legislative', 'State', 1),
('House Speaker', 'house-speaker', 'Legislative', 'State', 1)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 2: Create leader records
-- ============================================================================

-- Amy Klobuchar - U.S. Senator
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Amy Klobuchar', 'amy-klobuchar', 'DFL', true, 'https://www.klobuchar.senate.gov/')
ON CONFLICT (slug) DO NOTHING;

-- Tina Smith - U.S. Senator
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Tina Smith', 'tina-smith', 'DFL', true, 'https://www.smith.senate.gov/')
ON CONFLICT (slug) DO NOTHING;

-- Natalie Hudson - Chief Justice
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Natalie E. Hudson', 'natalie-hudson', NULL, true, 'https://www.mncourts.gov/Supreme-Court.aspx')
ON CONFLICT (slug) DO NOTHING;

-- Erin Murphy - Senate Majority Leader
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Erin Murphy', 'erin-murphy', 'DFL', true, 'https://www.senate.mn/members/member_bio.html?mem_id=1207')
ON CONFLICT (slug) DO NOTHING;

-- Lisa Demuth - House Speaker
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Lisa Demuth', 'lisa-demuth', 'Republican', true, 'https://www.house.leg.state.mn.us/members/profile/15511')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 3: Create terms
-- ============================================================================

-- Amy Klobuchar - U.S. Senator (4th term: 2025-2031)
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-03'::date,
  '2031-01-03'::date,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'amy-klobuchar'
  AND p.slug = 'us-senator'
  AND j.slug = 'us-senate-mn';

-- Tina Smith - U.S. Senator (term: 2021-2027)
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2021-01-03'::date,
  '2027-01-03'::date,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'tina-smith'
  AND p.slug = 'us-senator'
  AND j.slug = 'us-senate-mn';

-- Natalie Hudson - Chief Justice (term: 2024-2031, elected Nov 2024)
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2023-10-02'::date,  -- Appointed date
  '2031-01-01'::date,  -- Term expires
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'natalie-hudson'
  AND p.slug = 'chief-justice'
  AND j.slug = 'mn-judicial';

-- Erin Murphy - Senate Majority Leader (2024-present)
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2024-02-06'::date,
  NULL,  -- Leadership positions don't have fixed end dates
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'erin-murphy'
  AND p.slug = 'senate-majority-leader'
  AND j.slug = 'mn-senate';

-- Lisa Demuth - House Speaker (2025-present)
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-02-06'::date,
  NULL,  -- Leadership positions don't have fixed end dates
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'lisa-demuth'
  AND p.slug = 'house-speaker'
  AND j.slug = 'mn-house';


