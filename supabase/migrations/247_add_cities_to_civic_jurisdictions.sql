-- Add all cities to civic.jurisdictions table
-- Links cities to their parent county jurisdiction

-- ============================================================================
-- STEP 1: Insert all cities as jurisdictions (parent = their county)
-- ============================================================================

INSERT INTO civic.jurisdictions (name, slug, type, parent_id, city_id)
SELECT 
  ci.name,
  ci.slug,
  'City',
  -- Find the county jurisdiction that matches this city's county_id
  (SELECT j.id FROM civic.jurisdictions j WHERE j.county_id = ci.county_id LIMIT 1),
  ci.id
FROM atlas.cities ci
WHERE ci.slug IS NOT NULL
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 2: Report results
-- ============================================================================

DO $$
DECLARE
  v_city_count INTEGER;
  v_with_parent INTEGER;
  v_without_parent INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_city_count 
  FROM civic.jurisdictions WHERE type = 'City';
  
  SELECT COUNT(*) INTO v_with_parent 
  FROM civic.jurisdictions WHERE type = 'City' AND parent_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_without_parent 
  FROM civic.jurisdictions WHERE type = 'City' AND parent_id IS NULL;
  
  RAISE NOTICE '=== City Jurisdictions Added ===';
  RAISE NOTICE 'Total city jurisdictions: %', v_city_count;
  RAISE NOTICE 'With county parent: %', v_with_parent;
  RAISE NOTICE 'Without county parent: %', v_without_parent;
END;
$$;




