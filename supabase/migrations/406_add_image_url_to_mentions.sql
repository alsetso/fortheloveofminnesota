-- Add image_url column to mentions table for user-uploaded photos
-- This allows users to attach a single image to each mention

-- ============================================================================
-- STEP 1: Add image_url column to mentions table
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================================================
-- STEP 2: Create index for image_url queries (optional, for future filtering)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mentions_image_url ON public.mentions(image_url) WHERE image_url IS NOT NULL;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.mentions.image_url IS 'URL to user-uploaded image associated with this mention. Stored in mentions-media storage bucket.';

