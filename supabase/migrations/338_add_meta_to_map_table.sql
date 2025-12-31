-- Add meta JSONB column to map table for storing Mapbox configuration settings
-- This allows storing native Mapbox features like 3D buildings, pitch, bearing, terrain, etc.

-- ============================================================================
-- STEP 1: Add meta column to map table
-- ============================================================================

ALTER TABLE public.map
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- STEP 2: Create index for meta column (for JSONB queries)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_meta ON public.map USING GIN (meta);

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.map.meta IS 'JSONB object storing Mapbox configuration settings:
{
  "buildingsEnabled": boolean,      // Toggle 3D building extrusions (default: false)
  "pitch": number,                  // Map tilt angle 0-60 degrees (default: 0)
  "terrainEnabled": boolean         // Toggle 3D terrain elevation (default: false)
}';

