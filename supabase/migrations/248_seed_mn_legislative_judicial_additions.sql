-- Seed additional Minnesota legislative and judicial leaders
-- Senate President, House Majority/Minority Leaders, Supreme Court Justices, Court of Appeals Chief Judge

-- ============================================================================
-- STEP 1: Create additional positions
-- ============================================================================

INSERT INTO civic.positions (title, slug, branch, level, authority_rank) VALUES
-- Legislative
('Senate President', 'senate-president', 'Legislative', 'State', 1),
('House Majority Leader', 'house-majority-leader', 'Legislative', 'State', 2),
('House Minority Leader', 'house-minority-leader', 'Legislative', 'State', 2),
-- Judicial
('Associate Justice', 'associate-justice', 'Judicial', 'State', 2),
('Chief Judge, Court of Appeals', 'chief-judge-court-of-appeals', 'Judicial', 'State', 2)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 2: Create jurisdiction for Court of Appeals (if not exists)
-- ============================================================================

INSERT INTO civic.jurisdictions (name, slug, type, parent_id) VALUES
('Minnesota Court of Appeals', 'mn-court-of-appeals', 'Judicial', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'minnesota'))
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 3: Create leader records - Legislative
-- ============================================================================

-- Bobby Joe Champion - Senate President
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'Bobby Joe Champion', 'bobby-joe-champion', 'DFL', true, 
  'https://www.senate.mn/members/member_bio.html?mem_id=1145',
  'Senate President (2025). First Black Senate President in Minnesota history. State Senator representing Minneapolis since 2013. Attorney and former state representative.')
ON CONFLICT (slug) DO NOTHING;

-- Harry Niska - House Majority Leader
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'Harry Niska', 'harry-niska', 'Republican', true, 
  'https://www.house.leg.state.mn.us/members/profile/15558',
  'House Majority Leader (2025). State Representative from Ramsey (District 26A). Attorney. Part of Republican leadership under power-sharing agreement.')
ON CONFLICT (slug) DO NOTHING;

-- Jamie Long - House Minority Leader
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'Jamie Long', 'jamie-long', 'DFL', true, 
  'https://www.house.leg.state.mn.us/members/profile/15516',
  'House Minority Leader (2025). State Representative from Minneapolis (District 61B) since 2019. Focus on housing, climate, and transit policy.')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 4: Create leader records - Supreme Court Associate Justices
-- ============================================================================

-- Margaret H. Chutich
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'Margaret H. Chutich', 'margaret-chutich', NULL, true, 
  'https://www.mncourts.gov/Supreme-Court.aspx',
  'Minnesota Supreme Court Associate Justice since 2016. Appointed by Governor Dayton. Former Court of Appeals judge. First openly LGBTQ+ justice on MN Supreme Court.')
ON CONFLICT (slug) DO NOTHING;

-- G. Barry Anderson
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'G. Barry Anderson', 'g-barry-anderson', NULL, true, 
  'https://www.mncourts.gov/Supreme-Court.aspx',
  'Minnesota Supreme Court Associate Justice since 2004. Appointed by Governor Pawlenty. Longest-serving current justice. Former Court of Appeals judge.')
ON CONFLICT (slug) DO NOTHING;

-- Anne K. McKeig
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'Anne K. McKeig', 'anne-mckeig', NULL, true, 
  'https://www.mncourts.gov/Supreme-Court.aspx',
  'Minnesota Supreme Court Associate Justice since 2016. Appointed by Governor Dayton. First Native American to serve on MN Supreme Court. Member of White Earth Band of Ojibwe.')
ON CONFLICT (slug) DO NOTHING;

-- Paul H. Thissen
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'Paul H. Thissen', 'paul-thissen', NULL, true, 
  'https://www.mncourts.gov/Supreme-Court.aspx',
  'Minnesota Supreme Court Associate Justice since 2018. Appointed by Governor Dayton. Former Speaker of the Minnesota House (2013-2015). Former state representative.')
ON CONFLICT (slug) DO NOTHING;

-- Karl Procaccini
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'Karl Procaccini', 'karl-procaccini', NULL, true, 
  'https://www.mncourts.gov/Supreme-Court.aspx',
  'Minnesota Supreme Court Associate Justice since 2023. Appointed by Governor Walz. Former federal prosecutor and private practice attorney.')
ON CONFLICT (slug) DO NOTHING;

-- Theodora K. Gaïtas
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'Theodora K. Gaïtas', 'theodora-gaitas', NULL, true, 
  'https://www.mncourts.gov/Supreme-Court.aspx',
  'Minnesota Supreme Court Associate Justice since 2024. Appointed by Governor Walz. Part of court''s first female majority in decades. Former district court judge.')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 5: Create leader record - Court of Appeals
-- ============================================================================

-- Jennifer L. Frisch - Chief Judge, Court of Appeals
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url, notes) VALUES
(civic.generate_mn_id(), 'Jennifer L. Frisch', 'jennifer-frisch', NULL, true, 
  'https://www.mncourts.gov/About-The-Courts/Court-of-Appeals.aspx',
  'Chief Judge of Minnesota Court of Appeals. Leads the state''s intermediate appellate court. Former district court judge.')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 6: Create terms - Legislative Leadership
-- ============================================================================

-- Bobby Joe Champion - Senate President
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-01-14'::date,
  NULL,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'bobby-joe-champion'
  AND p.slug = 'senate-president'
  AND j.slug = 'mn-senate';

-- Harry Niska - House Majority Leader
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-02-06'::date,
  NULL,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'harry-niska'
  AND p.slug = 'house-majority-leader'
  AND j.slug = 'mn-house';

-- Jamie Long - House Minority Leader
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2025-02-06'::date,
  NULL,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'jamie-long'
  AND p.slug = 'house-minority-leader'
  AND j.slug = 'mn-house';

-- ============================================================================
-- STEP 7: Create terms - Supreme Court Associate Justices
-- ============================================================================

-- Margaret H. Chutich
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2016-09-01'::date,
  NULL,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'margaret-chutich'
  AND p.slug = 'associate-justice'
  AND j.slug = 'mn-judicial';

-- G. Barry Anderson
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2004-10-01'::date,
  NULL,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'g-barry-anderson'
  AND p.slug = 'associate-justice'
  AND j.slug = 'mn-judicial';

-- Anne K. McKeig
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2016-07-01'::date,
  NULL,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'anne-mckeig'
  AND p.slug = 'associate-justice'
  AND j.slug = 'mn-judicial';

-- Paul H. Thissen
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2018-03-01'::date,
  NULL,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'paul-thissen'
  AND p.slug = 'associate-justice'
  AND j.slug = 'mn-judicial';

-- Karl Procaccini
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2023-05-01'::date,
  NULL,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'karl-procaccini'
  AND p.slug = 'associate-justice'
  AND j.slug = 'mn-judicial';

-- Theodora K. Gaïtas
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2024-04-01'::date,
  NULL,
  true,
  false
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'theodora-gaitas'
  AND p.slug = 'associate-justice'
  AND j.slug = 'mn-judicial';

-- ============================================================================
-- STEP 8: Create term - Court of Appeals Chief Judge
-- ============================================================================

-- Jennifer L. Frisch - Chief Judge, Court of Appeals
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2023-01-01'::date,
  NULL,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'jennifer-frisch'
  AND p.slug = 'chief-judge-court-of-appeals'
  AND j.slug = 'mn-court-of-appeals';



