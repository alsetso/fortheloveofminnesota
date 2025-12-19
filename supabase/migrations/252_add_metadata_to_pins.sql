-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add location_metadata and atlas_metadata to pins table
-- 
-- Captures Mapbox feature metadata and atlas entity details when a pin is created
-- ═══════════════════════════════════════════════════════════════════════════

-- Add location_metadata column for Mapbox feature data
-- Stores: layerId, sourceLayer, name, category, class, type, properties, etc.
ALTER TABLE public.pins
ADD COLUMN IF NOT EXISTS location_metadata JSONB DEFAULT NULL;

-- Add atlas_metadata column for atlas entity data
-- Stores: entityId, entityType, name, emoji, etc. when pin is on an atlas entity
ALTER TABLE public.pins
ADD COLUMN IF NOT EXISTS atlas_metadata JSONB DEFAULT NULL;

-- Add index for querying pins by location metadata category
CREATE INDEX IF NOT EXISTS idx_pins_location_metadata_category 
ON public.pins ((location_metadata->>'category'))
WHERE location_metadata IS NOT NULL;

-- Add index for querying pins by atlas entity type
CREATE INDEX IF NOT EXISTS idx_pins_atlas_metadata_type 
ON public.pins ((atlas_metadata->>'entityType'))
WHERE atlas_metadata IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.pins.location_metadata IS 'Mapbox feature metadata captured at pin creation (layerId, sourceLayer, name, category, class, type, properties)';
COMMENT ON COLUMN public.pins.atlas_metadata IS 'Atlas entity metadata captured at pin creation (entityId, entityType, name, emoji)';
