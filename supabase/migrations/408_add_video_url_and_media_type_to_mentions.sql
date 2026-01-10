-- Add video_url and media_type columns to mentions table
-- This allows mentions to support both images and videos

-- ============================================================================
-- STEP 1: Add video_url column
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- ============================================================================
-- STEP 2: Add media_type column
-- ============================================================================

-- Create media_type enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.mention_media_type AS ENUM ('image', 'video', 'none');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS media_type public.mention_media_type NOT NULL DEFAULT 'none';

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mentions_video_url ON public.mentions(video_url) WHERE video_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_media_type ON public.mentions(media_type);

-- ============================================================================
-- STEP 4: Update existing mentions
-- ============================================================================

-- Set media_type based on existing image_url
UPDATE public.mentions
SET media_type = CASE
  WHEN image_url IS NOT NULL THEN 'image'::public.mention_media_type
  ELSE 'none'::public.mention_media_type
END;

-- ============================================================================
-- STEP 5: Add comments
-- ============================================================================

COMMENT ON COLUMN public.mentions.video_url IS 'URL to user-uploaded video associated with this mention. Stored in mentions-media storage bucket.';
COMMENT ON COLUMN public.mentions.media_type IS 'Type of media attached to this mention: image, video, or none.';

