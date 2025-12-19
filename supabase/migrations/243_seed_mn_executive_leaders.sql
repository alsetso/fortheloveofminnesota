-- Seed Minnesota statewide executive leaders
-- Governor, Lieutenant Governor, Secretary of State, Attorney General, State Auditor

-- ============================================================================
-- STEP 1: Create statewide executive positions
-- ============================================================================

INSERT INTO civic.positions (title, slug, branch, level, authority_rank) VALUES
('Governor', 'governor', 'Executive', 'State', 1),
('Lieutenant Governor', 'lieutenant-governor', 'Executive', 'State', 2),
('Secretary of State', 'secretary-of-state', 'Executive', 'State', 3),
('Attorney General', 'attorney-general', 'Executive', 'State', 4),
('State Auditor', 'state-auditor', 'Executive', 'State', 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 2: Create leader records
-- ============================================================================

-- Helper function to generate 12-char mn_id
CREATE OR REPLACE FUNCTION civic.generate_mn_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Tim Walz - Governor
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Tim Walz', 'tim-walz', 'DFL', true, 'https://mn.gov/governor/')
ON CONFLICT (slug) DO NOTHING;

-- Peggy Flanagan - Lieutenant Governor
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Peggy Flanagan', 'peggy-flanagan', 'DFL', true, 'https://mn.gov/governor/lt-governor/')
ON CONFLICT (slug) DO NOTHING;

-- Steve Simon - Secretary of State
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Steve Simon', 'steve-simon', 'DFL', true, 'https://www.sos.state.mn.us/')
ON CONFLICT (slug) DO NOTHING;

-- Keith Ellison - Attorney General
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Keith Ellison', 'keith-ellison', 'DFL', true, 'https://www.ag.state.mn.us/')
ON CONFLICT (slug) DO NOTHING;

-- Julie Blaha - State Auditor
INSERT INTO civic.leaders (mn_id, full_name, slug, party, is_active, official_url) VALUES
(civic.generate_mn_id(), 'Julie Blaha', 'julie-blaha', 'DFL', true, 'https://www.osa.state.mn.us/')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 3: Create current terms (2023-2027)
-- ============================================================================

-- Tim Walz - Governor
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2023-01-02'::date,
  '2027-01-04'::date,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'tim-walz'
  AND p.slug = 'governor'
  AND j.slug = 'mn-executive';

-- Peggy Flanagan - Lieutenant Governor
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2023-01-02'::date,
  '2027-01-04'::date,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'peggy-flanagan'
  AND p.slug = 'lieutenant-governor'
  AND j.slug = 'mn-executive';

-- Steve Simon - Secretary of State
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2023-01-02'::date,
  '2027-01-04'::date,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'steve-simon'
  AND p.slug = 'secretary-of-state'
  AND j.slug = 'mn-executive';

-- Keith Ellison - Attorney General
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2023-01-02'::date,
  '2027-01-04'::date,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'keith-ellison'
  AND p.slug = 'attorney-general'
  AND j.slug = 'mn-executive';

-- Julie Blaha - State Auditor
INSERT INTO civic.terms (leader_id, position_id, jurisdiction_id, start_date, end_date, is_current, is_leadership)
SELECT 
  l.id,
  p.id,
  j.id,
  '2023-01-02'::date,
  '2027-01-04'::date,
  true,
  true
FROM civic.leaders l, civic.positions p, civic.jurisdictions j
WHERE l.slug = 'julie-blaha'
  AND p.slug = 'state-auditor'
  AND j.slug = 'mn-executive';

