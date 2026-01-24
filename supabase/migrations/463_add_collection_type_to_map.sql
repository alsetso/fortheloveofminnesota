-- Add collection_type column to public.map table
-- This allows dynamic categorization of maps (community, professional, user, etc.)
-- Replaces hardcoded constants with database-driven categorization

-- ============================================================================
-- STEP 1: Add collection_type column
-- ============================================================================

ALTER TABLE public.map
ADD COLUMN IF NOT EXISTS collection_type TEXT;

-- ============================================================================
-- STEP 2: Add check constraint for valid collection types
-- ============================================================================

ALTER TABLE public.map
DROP CONSTRAINT IF EXISTS map_collection_type_check;

ALTER TABLE public.map
ADD CONSTRAINT map_collection_type_check CHECK (
  collection_type IS NULL OR collection_type IN (
    'community',
    'professional',
    'user',
    'atlas',
    'gov'
  )
);

-- ============================================================================
-- STEP 3: Create index for filtering by collection type
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_collection_type ON public.map(collection_type) 
  WHERE collection_type IS NOT NULL;

-- ============================================================================
-- STEP 4: Add comment
-- ============================================================================

COMMENT ON COLUMN public.map.collection_type IS 'Dynamic collection/category type for the map. Used to group maps in the maps listing page (community, professional, user, atlas, gov). Replaces hardcoded constants with database-driven categorization.';

-- ============================================================================
-- STEP 5: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
