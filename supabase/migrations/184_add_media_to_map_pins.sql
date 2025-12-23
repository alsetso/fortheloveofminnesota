-- Add media_url column to map_pins table for photo/video support
-- One media item per pin (photo or video)

-- ============================================================================
-- STEP 1: Add media_url column
-- ============================================================================

ALTER TABLE public.map_pins
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- ============================================================================
-- STEP 2: Create index for media_url queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_pins_media_url ON public.map_pins(media_url) WHERE media_url IS NOT NULL;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.map_pins.media_url IS 'URL to photo or video associated with this pin (one media item per pin)';





