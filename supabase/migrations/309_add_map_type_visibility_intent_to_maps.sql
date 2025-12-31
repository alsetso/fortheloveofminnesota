-- Add map_type, visibility, and intent columns to maps table
-- map_type: Type of map (e.g., 'user', 'community', 'professional')
-- visibility: Visibility level (e.g., 'private', 'public', 'shared')
-- intent: Optional intent/purpose of the map

-- ============================================================================
-- STEP 1: Add columns to maps table
-- ============================================================================

ALTER TABLE public.maps
ADD COLUMN IF NOT EXISTS map_type TEXT NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private',
ADD COLUMN IF NOT EXISTS intent TEXT;

-- ============================================================================
-- STEP 2: Create indexes for new columns
-- ============================================================================

-- Index for filtering by map_type
CREATE INDEX IF NOT EXISTS idx_maps_map_type ON public.maps(map_type);

-- Index for filtering by visibility
CREATE INDEX IF NOT EXISTS idx_maps_visibility ON public.maps(visibility);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_maps_type_visibility ON public.maps(map_type, visibility);

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================

COMMENT ON COLUMN public.maps.map_type IS 'Type of map: user (user-generated), community, professional, etc.';
COMMENT ON COLUMN public.maps.visibility IS 'Visibility level: private (owner only), public (everyone), shared (via map_shares)';
COMMENT ON COLUMN public.maps.intent IS 'Optional intent or purpose of the map (e.g., mentions, fraud, realestate, skip-tracing)';

