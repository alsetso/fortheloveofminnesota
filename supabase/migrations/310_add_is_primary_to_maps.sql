-- Add is_primary column to maps table
-- Ensures only one "primary" community map exists (the canonical Minnesota map)
-- All other maps are views, workspaces, or collections

-- ============================================================================
-- STEP 1: Add is_primary column
-- ============================================================================

ALTER TABLE public.maps
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 2: Create unique partial index to enforce only one primary community map
-- ============================================================================

-- Ensure only one map can have map_type = 'community' AND is_primary = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_maps_primary_community 
  ON public.maps(map_type, is_primary) 
  WHERE map_type = 'community' AND is_primary = true;

-- ============================================================================
-- STEP 3: Create index for filtering primary maps
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_maps_is_primary ON public.maps(is_primary) 
  WHERE is_primary = true;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON COLUMN public.maps.is_primary IS 'Whether this is the primary/canonical map for its type. Only one community map can be primary (the Minnesota map). All other maps are views, workspaces, or collections.';
COMMENT ON COLUMN public.maps.map_type IS 'Type of map: community (system/admin created, e.g., the Minnesota map), professional (paid or verified access), or user (default, user-generated).';
COMMENT ON COLUMN public.maps.intent IS 'Purpose/intent of the map. Examples: awareness, reporting, planning, monitoring, business, personal. Used for grouping maps in UI and recommending defaults.';

