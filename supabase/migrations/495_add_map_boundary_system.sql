-- Add boundary enum and boundary_data column to map table
-- Allows maps to be scoped to specific geographic boundaries (statewide, county, city, town, district)

-- ============================================================================
-- STEP 1: Create map_boundary enum type
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'map_boundary') THEN
    CREATE TYPE public.map_boundary AS ENUM ('statewide', 'county', 'city', 'town', 'district');
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add boundary and boundary_data columns to map table
-- ============================================================================

-- Add boundary column with default 'statewide'
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS boundary public.map_boundary NOT NULL DEFAULT 'statewide';

-- Add boundary_data JSONB column to store selected boundary details
-- Example: {"county_id": "uuid", "county_name": "Hennepin", ...}
-- Example: {"city_id": "uuid", "city_name": "Minneapolis", ...}
-- Example: {"district_number": 5, "district_name": "Minnesota's 5th Congressional District", ...}
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS boundary_data JSONB DEFAULT NULL;

-- ============================================================================
-- STEP 3: Add indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_boundary ON public.map(boundary);
CREATE INDEX IF NOT EXISTS idx_map_boundary_data ON public.map USING GIN (boundary_data) WHERE boundary_data IS NOT NULL;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON COLUMN public.map.boundary IS 'Geographic boundary scope: statewide (entire state), county, city, town, or district';
COMMENT ON COLUMN public.map.boundary_data IS 'JSONB object containing selected boundary details (e.g., county_id, county_name for county boundary)';

-- ============================================================================
-- STEP 5: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
