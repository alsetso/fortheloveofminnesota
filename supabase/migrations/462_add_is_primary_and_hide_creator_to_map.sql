-- Add is_primary and hide_creator columns to public.map table
-- is_primary: Marks a map as the primary/canonical map for its type
-- hide_creator: Hides the creator badge on the map card (useful for system/admin maps)

-- ============================================================================
-- STEP 1: Add is_primary column
-- ============================================================================

ALTER TABLE public.map
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 2: Add hide_creator column
-- ============================================================================

ALTER TABLE public.map
ADD COLUMN IF NOT EXISTS hide_creator BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 3: Create index for filtering primary maps (non-unique to allow multiple)
-- ============================================================================

-- Note: is_primary is a boolean flag, not unique. Multiple maps can be marked as primary.
-- If you need to enforce only one primary map, add a unique constraint later.

-- ============================================================================
-- STEP 4: Create index for filtering primary maps
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_is_primary ON public.map(is_primary) 
  WHERE is_primary = true;

-- ============================================================================
-- STEP 5: Create index for filtering maps with hidden creators
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_hide_creator ON public.map(hide_creator) 
  WHERE hide_creator = true;

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON COLUMN public.map.is_primary IS 'Whether this is the primary/canonical map. Only one map can be marked as primary. Useful for system/admin maps that should be featured.';
COMMENT ON COLUMN public.map.hide_creator IS 'If true, the creator badge will be hidden on the map card. Useful for system/admin maps where the creator is irrelevant.';

-- ============================================================================
-- STEP 7: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
