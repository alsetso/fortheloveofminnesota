-- Add icon_url column to mentions table
-- References the icon selected when creating a mention

-- ============================================================================
-- STEP 1: Add icon_url column to mentions table
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- ============================================================================
-- STEP 2: Create index for icon_url queries (optional, for future filtering)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mentions_icon_url ON public.mentions(icon_url) WHERE icon_url IS NOT NULL;

-- ============================================================================
-- STEP 3: Set default icon_url for existing mentions (heart.png fallback)
-- ============================================================================

-- Update existing mentions to use default heart icon
UPDATE public.mentions
SET icon_url = '/heart.png'
WHERE icon_url IS NULL;

-- ============================================================================
-- STEP 4: Add comment
-- ============================================================================

COMMENT ON COLUMN public.mentions.icon_url IS 'URL to the icon image for this mention pin. References mention_icons.icon_url or a default icon path. Defaults to /heart.png for backward compatibility.';

