-- Create public map pins table
-- This table stores public map pins that are readable by everyone
-- Authenticated users can insert, update, and delete their own pins

-- ============================================================================
-- STEP 1: Create map_pins table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.map_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Coordinates (Mapbox optimal: double precision)
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  
  -- Metadata fields
  label TEXT,
  description TEXT,
  type TEXT,
  color TEXT,
  icon TEXT,
  
  -- Relational fields
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  county_id UUID REFERENCES public.counties(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for optimal performance
-- ============================================================================

-- Spatial index for lat/lng queries (Mapbox optimal)
CREATE INDEX idx_map_pins_lat_lng ON public.map_pins(lat, lng);

-- Index on type for filtering
CREATE INDEX idx_map_pins_type ON public.map_pins(type) WHERE type IS NOT NULL;

-- Index on account_id for ownership queries
CREATE INDEX idx_map_pins_account_id ON public.map_pins(account_id) WHERE account_id IS NOT NULL;

-- Index on optional relational fields
CREATE INDEX idx_map_pins_post_id ON public.map_pins(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_map_pins_city_id ON public.map_pins(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX idx_map_pins_county_id ON public.map_pins(county_id) WHERE county_id IS NOT NULL;

-- Index on created_at for sorting
CREATE INDEX idx_map_pins_created_at ON public.map_pins(created_at DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_map_pins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_map_pins_updated_at
  BEFORE UPDATE ON public.map_pins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_map_pins_updated_at();

-- ============================================================================
-- STEP 4: Enable RLS
-- ============================================================================

ALTER TABLE public.map_pins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies
-- ============================================================================

-- Policy: All pins are publicly readable
CREATE POLICY "Public read access for map pins"
  ON public.map_pins
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Authenticated users can insert their own pins
CREATE POLICY "Users can insert own map pins"
  ON public.map_pins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Policy: Authenticated users can update their own pins
CREATE POLICY "Users can update own map pins"
  ON public.map_pins
  FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Policy: Authenticated users can delete their own pins
CREATE POLICY "Users can delete own map pins"
  ON public.map_pins
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON TABLE public.map_pins IS 'Public map pins that are readable by everyone. Authenticated users can manage their own pins.';
COMMENT ON COLUMN public.map_pins.lat IS 'Latitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.map_pins.lng IS 'Longitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.map_pins.label IS 'Display label for the pin';
COMMENT ON COLUMN public.map_pins.description IS 'Optional description text';
COMMENT ON COLUMN public.map_pins.type IS 'Pin type/category for filtering';
COMMENT ON COLUMN public.map_pins.color IS 'Pin color (hex code or color name)';
COMMENT ON COLUMN public.map_pins.icon IS 'Icon identifier or emoji';
COMMENT ON COLUMN public.map_pins.account_id IS 'Account that owns this pin (required for authenticated users)';
COMMENT ON COLUMN public.map_pins.post_id IS 'Optional reference to a post';
COMMENT ON COLUMN public.map_pins.city_id IS 'Optional reference to a city';
COMMENT ON COLUMN public.map_pins.county_id IS 'Optional reference to a county';


