-- Add map_layers column to public.map table
-- Stores per-map layer visibility toggles (e.g., CTU, congressional districts)
--
-- Example:
-- {
--   "congressional_districts": true,
--   "ctu_boundaries": false,
--   "state_boundary": false,
--   "county_boundaries": false
-- }
--
-- ============================================================================
-- STEP 1: Add map_layers column
-- ============================================================================

ALTER TABLE public.map
ADD COLUMN IF NOT EXISTS map_layers JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- STEP 2: Ensure map_layers is always an object
-- ============================================================================

ALTER TABLE public.map
DROP CONSTRAINT IF EXISTS map_layers_is_object;

ALTER TABLE public.map
ADD CONSTRAINT map_layers_is_object CHECK (jsonb_typeof(map_layers) = 'object');

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.map.map_layers IS 'JSONB object storing per-map layer visibility toggles. Keys are layer identifiers (e.g., congressional_districts, ctu_boundaries, state_boundary, county_boundaries) and values are booleans.';

-- ============================================================================
-- STEP 4: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';

