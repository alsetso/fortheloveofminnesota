-- Add atlas_meta JSONB column to mentions table
-- This stores atlas entity metadata (parks, schools, cities, lakes, etc.) when a mention is created
-- on an atlas entity pin, similar to how map_meta stores location and map feature metadata

-- ============================================================================
-- STEP 1: Add atlas_meta column to mentions table
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS atlas_meta JSONB;

-- ============================================================================
-- STEP 2: Create index for JSONB queries (optional, for future filtering/search)
-- ============================================================================

-- GIN index for efficient JSONB queries (if needed in the future)
CREATE INDEX IF NOT EXISTS idx_mentions_atlas_meta ON public.mentions USING GIN (atlas_meta) WHERE atlas_meta IS NOT NULL;

-- Index for querying mentions by atlas entity table_name (e.g., 'parks', 'schools', 'cities')
CREATE INDEX IF NOT EXISTS idx_mentions_atlas_meta_table_name 
  ON public.mentions ((atlas_meta->>'table_name'))
  WHERE atlas_meta IS NOT NULL;

-- Index for querying mentions by atlas entity id
CREATE INDEX IF NOT EXISTS idx_mentions_atlas_meta_id 
  ON public.mentions ((atlas_meta->>'id'))
  WHERE atlas_meta IS NOT NULL;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.mentions.atlas_meta IS 'JSON metadata containing atlas entity details (id, name, table_name, description, address, etc.) when a mention is created on an atlas entity pin (parks, schools, cities, lakes, churches, hospitals, golf_courses, municipals). Null when mention is created on a regular map location.';

