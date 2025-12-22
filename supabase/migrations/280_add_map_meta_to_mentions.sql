-- Add map_meta JSON column to mentions table
-- This stores all location metadata from the location details passed to the mention form

-- ============================================================================
-- STEP 1: Add map_meta column to mentions table
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS map_meta JSONB;

-- ============================================================================
-- STEP 2: Create index for JSONB queries (optional, for future filtering/search)
-- ============================================================================

-- GIN index for efficient JSONB queries (if needed in the future)
CREATE INDEX IF NOT EXISTS idx_mentions_map_meta ON public.mentions USING GIN (map_meta) WHERE map_meta IS NOT NULL;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.mentions.map_meta IS 'JSON metadata containing all location details from the map (placeName, address, city, county, state, postalCode, etc.) passed to the mention form at creation time.';
