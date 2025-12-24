-- Validate and fix city-county relationships
-- This migration checks for missing links and attempts to fix them

-- ============================================================================
-- STEP 1: Check current state
-- ============================================================================

DO $$
DECLARE
  v_total_cities INTEGER;
  v_cities_with_county_id INTEGER;
  v_cities_without_county_id INTEGER;
  v_cities_in_junction INTEGER;
  v_cities_not_in_junction INTEGER;
  v_total_junction_rows INTEGER;
  v_cities_with_multiple_counties INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_cities FROM public.cities;
  SELECT COUNT(*) INTO v_cities_with_county_id FROM public.cities WHERE county_id IS NOT NULL;
  SELECT COUNT(*) INTO v_cities_without_county_id FROM public.cities WHERE county_id IS NULL;
  
  SELECT COUNT(DISTINCT city_id) INTO v_cities_in_junction FROM public.city_counties;
  SELECT COUNT(*) INTO v_total_junction_rows FROM public.city_counties;
  
  SELECT COUNT(*) INTO v_cities_with_multiple_counties
  FROM (
    SELECT city_id, COUNT(*) as county_count
    FROM public.city_counties
    GROUP BY city_id
    HAVING COUNT(*) > 1
  ) multi_county;
  
  v_cities_not_in_junction := v_total_cities - v_cities_in_junction;

  RAISE NOTICE '=== Current State ===';
  RAISE NOTICE 'Total cities: %', v_total_cities;
  RAISE NOTICE 'Cities with county_id: %', v_cities_with_county_id;
  RAISE NOTICE 'Cities without county_id: %', v_cities_without_county_id;
  RAISE NOTICE 'Cities in junction table: %', v_cities_in_junction;
  RAISE NOTICE 'Cities NOT in junction table: %', v_cities_not_in_junction;
  RAISE NOTICE 'Total junction rows: %', v_total_junction_rows;
  RAISE NOTICE 'Cities with multiple counties: %', v_cities_with_multiple_counties;
END;
$$;

-- ============================================================================
-- STEP 2: Find cities missing from junction table
-- ============================================================================

-- Create a temporary view to see which cities are missing
CREATE OR REPLACE VIEW public.v_cities_missing_counties AS
SELECT 
  c.id,
  c.name,
  c.county AS county_text,
  c.county_id,
  CASE 
    WHEN c.county IS NULL OR c.county = '' THEN 'No county text'
    WHEN public.find_county_by_name(TRIM(SPLIT_PART(c.county, ',', 1))) IS NULL THEN 'County not found'
    ELSE 'Should be linked'
  END AS issue
FROM public.cities c
WHERE NOT EXISTS (
  SELECT 1 FROM public.city_counties cc WHERE cc.city_id = c.id
);

-- ============================================================================
-- STEP 3: Improved county matching function with better handling
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_county_by_name(p_county_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_county_id UUID;
  v_clean_name TEXT;
BEGIN
  -- Return NULL if input is empty
  IF p_county_name IS NULL OR TRIM(p_county_name) = '' THEN
    RETURN NULL;
  END IF;

  -- Clean the county name: remove "County" suffix, trim whitespace, handle "St." variations
  v_clean_name := TRIM(REGEXP_REPLACE(p_county_name, '\s+County$', '', 'i'));
  
  -- Handle "St." vs "Saint" variations
  v_clean_name := REGEXP_REPLACE(v_clean_name, '^St\.\s+', 'Saint ', 'i');
  v_clean_name := REGEXP_REPLACE(v_clean_name, '^St\s+', 'Saint ', 'i');

  -- Try exact match first (with "County" suffix)
  SELECT id INTO v_county_id
  FROM public.counties
  WHERE name = v_clean_name || ' County'
  LIMIT 1;

  -- If not found, try without "County" suffix
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM public.counties
    WHERE name = v_clean_name
    LIMIT 1;
  END IF;

  -- If still not found, try case-insensitive match with "County"
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM public.counties
    WHERE LOWER(name) = LOWER(v_clean_name || ' County')
    LIMIT 1;
  END IF;

  -- If still not found, try case-insensitive without "County"
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM public.counties
    WHERE LOWER(name) = LOWER(v_clean_name)
    LIMIT 1;
  END IF;

  -- If still not found, try matching against county name without "County" suffix
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM public.counties
    WHERE LOWER(REGEXP_REPLACE(name, '\s+County$', '', 'i')) = LOWER(v_clean_name)
    LIMIT 1;
  END IF;

  -- If still not found, try partial match (county name contains the search term)
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM public.counties
    WHERE LOWER(name) LIKE LOWER('%' || v_clean_name || '%')
    ORDER BY 
      CASE WHEN LOWER(name) = LOWER(v_clean_name || ' County') THEN 1
           WHEN LOWER(REGEXP_REPLACE(name, '\s+County$', '', 'i')) = LOWER(v_clean_name) THEN 2
           ELSE 3
      END
    LIMIT 1;
  END IF;

  RETURN v_county_id;
END;
$$;

-- ============================================================================
-- STEP 4: Fix cities missing from junction table
-- ============================================================================

-- Insert missing cities into junction table
INSERT INTO public.city_counties (city_id, county_id, is_primary)
SELECT 
  c.id AS city_id,
  public.find_county_by_name(TRIM(unnested_county)) AS county_id,
  -- Mark first county as primary
  ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY unnested_county) = 1 AS is_primary
FROM public.cities c
CROSS JOIN LATERAL unnest(string_to_array(c.county, ',')) AS unnested_county
WHERE NOT EXISTS (
  SELECT 1 FROM public.city_counties cc WHERE cc.city_id = c.id
)
  AND c.county IS NOT NULL 
  AND c.county != ''
  AND TRIM(unnested_county) != ''
  AND public.find_county_by_name(TRIM(unnested_county)) IS NOT NULL
ON CONFLICT (city_id, county_id) DO NOTHING;

-- ============================================================================
-- STEP 5: Update cities.county_id for cities missing it
-- ============================================================================

-- Update cities that don't have county_id set but have entries in junction table
UPDATE public.cities c
SET county_id = cc.county_id
FROM public.city_counties cc
WHERE c.id = cc.city_id
  AND cc.is_primary = true
  AND c.county_id IS NULL;

-- ============================================================================
-- STEP 6: Final validation report
-- ============================================================================

DO $$
DECLARE
  v_total_cities INTEGER;
  v_cities_with_county_id INTEGER;
  v_cities_without_county_id INTEGER;
  v_cities_in_junction INTEGER;
  v_cities_not_in_junction INTEGER;
  v_total_junction_rows INTEGER;
  v_cities_with_multiple_counties INTEGER;
  v_unmatched_counties TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total_cities FROM public.cities;
  SELECT COUNT(*) INTO v_cities_with_county_id FROM public.cities WHERE county_id IS NOT NULL;
  SELECT COUNT(*) INTO v_cities_without_county_id FROM public.cities WHERE county_id IS NULL;
  
  SELECT COUNT(DISTINCT city_id) INTO v_cities_in_junction FROM public.city_counties;
  SELECT COUNT(*) INTO v_total_junction_rows FROM public.city_counties;
  
  SELECT COUNT(*) INTO v_cities_with_multiple_counties
  FROM (
    SELECT city_id, COUNT(*) as county_count
    FROM public.city_counties
    GROUP BY city_id
    HAVING COUNT(*) > 1
  ) multi_county;
  
  v_cities_not_in_junction := v_total_cities - v_cities_in_junction;

  -- Get list of unmatched county names
  SELECT string_agg(DISTINCT c.county, ', ' ORDER BY c.county)
  INTO v_unmatched_counties
  FROM public.cities c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.city_counties cc WHERE cc.city_id = c.id
  )
  AND c.county IS NOT NULL
  AND c.county != ''
  LIMIT 10;

  RAISE NOTICE '=== Final State After Fix ===';
  RAISE NOTICE 'Total cities: %', v_total_cities;
  RAISE NOTICE 'Cities with county_id: %', v_cities_with_county_id;
  RAISE NOTICE 'Cities without county_id: %', v_cities_without_county_id;
  RAISE NOTICE 'Cities in junction table: %', v_cities_in_junction;
  RAISE NOTICE 'Cities NOT in junction table: %', v_cities_not_in_junction;
  RAISE NOTICE 'Total junction rows: %', v_total_junction_rows;
  RAISE NOTICE 'Cities with multiple counties: %', v_cities_with_multiple_counties;
  
  IF v_cities_not_in_junction > 0 THEN
    RAISE NOTICE 'WARNING: % cities are not linked to any county!', v_cities_not_in_junction;
    IF v_unmatched_counties IS NOT NULL THEN
      RAISE NOTICE 'Sample unmatched county names: %', v_unmatched_counties;
    END IF;
  END IF;
  
  IF v_cities_without_county_id > 0 THEN
    RAISE NOTICE 'WARNING: % cities do not have county_id set!', v_cities_without_county_id;
  END IF;
END;
$$;

-- ============================================================================
-- STEP 7: Create helper function to get all counties for a city
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_city_counties(p_city_id UUID)
RETURNS TABLE (
  county_id UUID,
  county_name TEXT,
  is_primary BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    co.id AS county_id,
    co.name AS county_name,
    cc.is_primary
  FROM public.city_counties cc
  JOIN public.counties co ON co.id = cc.county_id
  WHERE cc.city_id = p_city_id
  ORDER BY cc.is_primary DESC, co.name;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_city_counties(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.get_city_counties(UUID) IS 'Returns all counties associated with a city, with primary county first';





