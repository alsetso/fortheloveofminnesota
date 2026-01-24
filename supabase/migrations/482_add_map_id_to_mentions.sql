-- Add map_id column to mentions table
-- This allows mentions to be associated with specific maps (e.g., the "live" map)

-- ============================================================================
-- STEP 1: Add map_id column to mentions table
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS map_id UUID REFERENCES public.map(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 2: Create index for map_id queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mentions_map_id ON public.mentions(map_id) 
  WHERE map_id IS NOT NULL;

-- Composite index for map + visibility filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_mentions_map_id_visibility ON public.mentions(map_id, visibility) 
  WHERE map_id IS NOT NULL AND archived = false;

-- Composite index for map + account filtering
CREATE INDEX IF NOT EXISTS idx_mentions_map_id_account_id ON public.mentions(map_id, account_id) 
  WHERE map_id IS NOT NULL AND account_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.mentions.map_id IS 'Map ID reference for filtering mentions by map. Nullable - mentions may not always have an associated map.';
