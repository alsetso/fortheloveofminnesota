-- Create junction table for cities that span multiple counties
-- This allows a city to be associated with multiple counties

-- ============================================================================
-- STEP 1: Create city_counties junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.city_counties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  county_id UUID NOT NULL REFERENCES public.counties(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false, -- Mark the primary county
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique city-county pairs
  CONSTRAINT city_counties_unique UNIQUE (city_id, county_id)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_city_counties_city_id ON public.city_counties(city_id);
CREATE INDEX idx_city_counties_county_id ON public.city_counties(county_id);
CREATE INDEX idx_city_counties_primary ON public.city_counties(city_id, is_primary) WHERE is_primary = true;

-- ============================================================================
-- STEP 3: Populate junction table from cities.county text field
-- ============================================================================

-- Insert all county relationships for cities
INSERT INTO public.city_counties (city_id, county_id, is_primary)
SELECT 
  c.id AS city_id,
  public.find_county_by_name(TRIM(unnested_county)) AS county_id,
  -- Mark first county as primary
  ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY unnested_county) = 1 AS is_primary
FROM public.cities c
CROSS JOIN LATERAL unnest(string_to_array(c.county, ',')) AS unnested_county
WHERE c.county IS NOT NULL 
  AND c.county != ''
  AND TRIM(unnested_county) != ''
  AND public.find_county_by_name(TRIM(unnested_county)) IS NOT NULL
ON CONFLICT (city_id, county_id) DO NOTHING;

-- ============================================================================
-- STEP 4: Update cities.county_id to point to primary county
-- ============================================================================

UPDATE public.cities c
SET county_id = cc.county_id
FROM public.city_counties cc
WHERE c.id = cc.city_id
  AND cc.is_primary = true
  AND (c.county_id IS NULL OR c.county_id != cc.county_id);

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.city_counties ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read city-county relationships
CREATE POLICY "Anyone can read city_counties"
  ON public.city_counties
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can modify city-county relationships
CREATE POLICY "Admins can insert city_counties"
  ON public.city_counties
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update city_counties"
  ON public.city_counties
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete city_counties"
  ON public.city_counties
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON public.city_counties TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.city_counties TO authenticated;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE public.city_counties IS 'Junction table linking cities to counties. Allows cities to be associated with multiple counties.';
COMMENT ON COLUMN public.city_counties.is_primary IS 'True if this is the primary county for the city (used for cities.county_id foreign key)';

-- ============================================================================
-- STEP 8: Report results
-- ============================================================================

DO $$
DECLARE
  v_total_cities INTEGER;
  v_cities_with_multiple_counties INTEGER;
  v_total_relationships INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_cities FROM public.cities;
  
  SELECT COUNT(*) INTO v_cities_with_multiple_counties
  FROM (
    SELECT city_id, COUNT(*) as county_count
    FROM public.city_counties
    GROUP BY city_id
    HAVING COUNT(*) > 1
  ) multi_county;
  
  SELECT COUNT(*) INTO v_total_relationships FROM public.city_counties;

  RAISE NOTICE 'City-Counties Junction Table Summary:';
  RAISE NOTICE '  Total cities: %', v_total_cities;
  RAISE NOTICE '  Cities with multiple counties: %', v_cities_with_multiple_counties;
  RAISE NOTICE '  Total city-county relationships: %', v_total_relationships;
END;
$$;

