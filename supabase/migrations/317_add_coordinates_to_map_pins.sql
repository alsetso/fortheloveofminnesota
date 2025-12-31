-- Add lat/lng coordinates to map_pins table for map display

-- ============================================================================
-- STEP 1: Add coordinate columns
-- ============================================================================

ALTER TABLE public.map_pins
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- ============================================================================
-- STEP 2: Create spatial index for coordinate queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_pins_lat_lng ON public.map_pins(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================

COMMENT ON COLUMN public.map_pins.lat IS 'Latitude coordinate for pin location on map';
COMMENT ON COLUMN public.map_pins.lng IS 'Longitude coordinate for pin location on map';

