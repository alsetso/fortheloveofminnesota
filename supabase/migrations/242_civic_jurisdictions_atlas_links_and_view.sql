-- Add atlas FK links to jurisdictions and create unified view
-- Allows jurisdictions to reference existing cities/counties from atlas schema

-- ============================================================================
-- STEP 1: Add FK columns to jurisdictions
-- ============================================================================

ALTER TABLE civic.jurisdictions
  ADD COLUMN city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  ADD COLUMN county_id UUID REFERENCES atlas.counties(id) ON DELETE SET NULL;

-- Indexes for FK lookups
CREATE INDEX idx_civic_jurisdictions_city_id ON civic.jurisdictions(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX idx_civic_jurisdictions_county_id ON civic.jurisdictions(county_id) WHERE county_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Create unified view of all jurisdictions
-- ============================================================================

CREATE OR REPLACE VIEW civic.all_jurisdictions AS

-- Manual jurisdictions (Federal, State, Districts, Legislative bodies)
SELECT 
  j.id,
  j.name,
  j.slug,
  j.type,
  j.parent_id,
  NULL::uuid AS city_id,
  NULL::uuid AS county_id,
  'jurisdiction' AS source
FROM civic.jurisdictions j
WHERE j.city_id IS NULL AND j.county_id IS NULL

UNION ALL

-- Counties from atlas (with optional jurisdiction override)
SELECT
  COALESCE(j.id, c.id) AS id,
  COALESCE(j.name, c.name) AS name,
  COALESCE(j.slug, c.slug) AS slug,
  'County' AS type,
  j.parent_id,
  NULL::uuid AS city_id,
  c.id AS county_id,
  'county' AS source
FROM atlas.counties c
LEFT JOIN civic.jurisdictions j ON j.county_id = c.id

UNION ALL

-- Cities from atlas (with optional jurisdiction override)
SELECT
  COALESCE(j.id, ci.id) AS id,
  COALESCE(j.name, ci.name) AS name,
  COALESCE(j.slug, ci.slug) AS slug,
  'City' AS type,
  j.parent_id,
  ci.id AS city_id,
  NULL::uuid AS county_id,
  'city' AS source
FROM atlas.cities ci
LEFT JOIN civic.jurisdictions j ON j.city_id = ci.id;

-- ============================================================================
-- STEP 3: Grant permissions on view
-- ============================================================================

GRANT SELECT ON civic.all_jurisdictions TO anon, authenticated, service_role;

-- ============================================================================
-- STEP 4: Seed federal and state jurisdictions
-- ============================================================================

-- Federal level
INSERT INTO civic.jurisdictions (name, slug, type, parent_id) VALUES
('United States', 'united-states', 'Federal', NULL);

-- U.S. Senate (Minnesota delegation)
INSERT INTO civic.jurisdictions (name, slug, type, parent_id) VALUES
('U.S. Senate (Minnesota)', 'us-senate-mn', 'Federal', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states'));

-- Congressional Districts MN-01 through MN-08
INSERT INTO civic.jurisdictions (name, slug, type, parent_id) VALUES
('Minnesota 1st Congressional District', 'mn-01', 'Congressional District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states')),
('Minnesota 2nd Congressional District', 'mn-02', 'Congressional District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states')),
('Minnesota 3rd Congressional District', 'mn-03', 'Congressional District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states')),
('Minnesota 4th Congressional District', 'mn-04', 'Congressional District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states')),
('Minnesota 5th Congressional District', 'mn-05', 'Congressional District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states')),
('Minnesota 6th Congressional District', 'mn-06', 'Congressional District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states')),
('Minnesota 7th Congressional District', 'mn-07', 'Congressional District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states')),
('Minnesota 8th Congressional District', 'mn-08', 'Congressional District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states'));

-- State level
INSERT INTO civic.jurisdictions (name, slug, type, parent_id) VALUES
('Minnesota', 'minnesota', 'State', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'united-states'));

-- State bodies
INSERT INTO civic.jurisdictions (name, slug, type, parent_id) VALUES
('Minnesota Senate', 'mn-senate', 'Legislative', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'minnesota')),
('Minnesota House of Representatives', 'mn-house', 'Legislative', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'minnesota')),
('Minnesota Executive Branch', 'mn-executive', 'Executive', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'minnesota')),
('Minnesota Judicial Branch', 'mn-judicial', 'Judicial', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'minnesota'));

-- ============================================================================
-- STEP 5: Create jurisdiction records for all counties (link to atlas)
-- ============================================================================

INSERT INTO civic.jurisdictions (name, slug, type, parent_id, county_id)
SELECT 
  c.name,
  c.slug,
  'County',
  (SELECT id FROM civic.jurisdictions WHERE slug = 'minnesota'),
  c.id
FROM atlas.counties c
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 5b: Seed Minnesota Judicial Districts (10 total)
-- ============================================================================

INSERT INTO civic.jurisdictions (name, slug, type, parent_id) VALUES
('First Judicial District', 'mn-judicial-district-1', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial')),
('Second Judicial District', 'mn-judicial-district-2', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial')),
('Third Judicial District', 'mn-judicial-district-3', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial')),
('Fourth Judicial District', 'mn-judicial-district-4', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial')),
('Fifth Judicial District', 'mn-judicial-district-5', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial')),
('Sixth Judicial District', 'mn-judicial-district-6', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial')),
('Seventh Judicial District', 'mn-judicial-district-7', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial')),
('Eighth Judicial District', 'mn-judicial-district-8', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial')),
('Ninth Judicial District', 'mn-judicial-district-9', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial')),
('Tenth Judicial District', 'mn-judicial-district-10', 'Judicial District', 
  (SELECT id FROM civic.jurisdictions WHERE slug = 'mn-judicial'));

-- ============================================================================
-- STEP 5c: Document supported jurisdiction types
-- ============================================================================
-- Supported types (no enum, TEXT field for flexibility):
--   Federal, State, County, City, Township
--   Congressional District, Legislative
--   Executive, Judicial, Judicial District
--   School District, Special District
--
-- Townships (~1,800) and School Districts (~330) can be bulk-seeded separately
-- Special Districts include: watershed, soil/water, housing authorities, port authorities, etc.

-- ============================================================================
-- STEP 6: Create helper function to get jurisdiction by city
-- ============================================================================

CREATE OR REPLACE FUNCTION civic.get_city_jurisdiction(p_city_id UUID)
RETURNS UUID AS $$
DECLARE
  v_jurisdiction_id UUID;
BEGIN
  -- Check if city has explicit jurisdiction
  SELECT id INTO v_jurisdiction_id
  FROM civic.jurisdictions
  WHERE city_id = p_city_id;
  
  -- If not, return the city's county jurisdiction
  IF v_jurisdiction_id IS NULL THEN
    SELECT j.id INTO v_jurisdiction_id
    FROM civic.jurisdictions j
    JOIN atlas.cities ci ON ci.county_id = j.county_id
    WHERE ci.id = p_city_id;
  END IF;
  
  RETURN v_jurisdiction_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 7: Create public schema views for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.leaders AS SELECT * FROM civic.leaders;
CREATE OR REPLACE VIEW public.positions AS SELECT * FROM civic.positions;
CREATE OR REPLACE VIEW public.jurisdictions AS SELECT * FROM civic.jurisdictions;
CREATE OR REPLACE VIEW public.terms AS SELECT * FROM civic.terms;

-- Grant permissions on public views
GRANT SELECT ON public.leaders TO anon, authenticated;
GRANT SELECT ON public.positions TO anon, authenticated;
GRANT SELECT ON public.jurisdictions TO anon, authenticated;
GRANT SELECT ON public.terms TO anon, authenticated;

GRANT ALL ON public.leaders TO service_role;
GRANT ALL ON public.positions TO service_role;
GRANT ALL ON public.jurisdictions TO service_role;
GRANT ALL ON public.terms TO service_role;

-- ============================================================================
-- STEP 8: Create public view for all_jurisdictions
-- ============================================================================

CREATE OR REPLACE VIEW public.all_jurisdictions AS SELECT * FROM civic.all_jurisdictions;
GRANT SELECT ON public.all_jurisdictions TO anon, authenticated, service_role;

-- ============================================================================
-- STEP 9: Create helper function to get jurisdiction hierarchy
-- ============================================================================

CREATE OR REPLACE FUNCTION civic.get_jurisdiction_hierarchy(p_jurisdiction_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  type TEXT,
  depth INT
) AS $$
WITH RECURSIVE hierarchy AS (
  -- Base case: start with the given jurisdiction
  SELECT 
    j.id,
    j.name,
    j.slug,
    j.type,
    j.parent_id,
    0 AS depth
  FROM civic.jurisdictions j
  WHERE j.id = p_jurisdiction_id
  
  UNION ALL
  
  -- Recursive case: walk up to parent
  SELECT 
    p.id,
    p.name,
    p.slug,
    p.type,
    p.parent_id,
    h.depth + 1
  FROM civic.jurisdictions p
  JOIN hierarchy h ON p.id = h.parent_id
)
SELECT id, name, slug, type, depth FROM hierarchy ORDER BY depth DESC;
$$ LANGUAGE sql STABLE;


