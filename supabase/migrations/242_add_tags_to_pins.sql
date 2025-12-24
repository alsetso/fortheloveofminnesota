-- Add tags array column to pins for lightweight labeling
-- Users can tag pins with text labels like "favorite", "work", "family"

-- ============================================================================
-- STEP 1: Add tags column
-- ============================================================================

ALTER TABLE public.pins
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- ============================================================================
-- STEP 2: Add GIN index for efficient array queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pins_tags ON public.pins USING GIN (tags);

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.pins.tags IS 'Array of text labels for organizing pins (e.g., ["favorite", "work", "family"])';



