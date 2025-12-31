-- Add allow_others_to_post_pins column to map table
-- This boolean controls whether non-owners can post pins on the map

-- ============================================================================
-- STEP 1: Add allow_others_to_post_pins column
-- ============================================================================

ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS allow_others_to_post_pins BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 2: Create index for filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_allow_others_to_post_pins 
  ON public.map(allow_others_to_post_pins) 
  WHERE allow_others_to_post_pins = true;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.map.allow_others_to_post_pins IS 'If true, allows authenticated users (who are not the map owner) to post pins on this map';

