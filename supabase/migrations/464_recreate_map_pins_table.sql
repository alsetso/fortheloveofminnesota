-- Recreate map_pins table for custom maps
-- Pins are point markers on maps with emoji, caption, image, video

-- ============================================================================
-- STEP 1: Create map_pins table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.map_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  
  -- Pin content
  emoji TEXT,
  caption TEXT,
  image_url TEXT,
  video_url TEXT,
  
  -- Coordinates (required for map display)
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_pins_map_id ON public.map_pins(map_id);
CREATE INDEX IF NOT EXISTS idx_map_pins_created_at ON public.map_pins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_pins_lat_lng ON public.map_pins(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_map_pins_updated_at
  BEFORE UPDATE ON public.map_pins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.map_pins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies
-- ============================================================================

-- Policy: Users can view pins on maps they can access
CREATE POLICY "Users can view pins on accessible maps"
  ON public.map_pins
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_pins.map_id
      AND (
        map.visibility = 'public'
        OR (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = map.account_id
            AND accounts.user_id = auth.uid()
          )
        )
      )
    )
  );

-- Policy: Authenticated users can create pins on maps they can access
CREATE POLICY "Users can create pins on accessible maps"
  ON public.map_pins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_pins.map_id
      AND (
        -- Map owner can always create pins
        EXISTS (
          SELECT 1 FROM public.accounts
          WHERE accounts.id = map.account_id
          AND accounts.user_id = auth.uid()
        )
        OR
        -- Public maps allow anyone to create pins
        map.visibility = 'public'
      )
    )
  );

-- Policy: Users can update pins on maps they own
CREATE POLICY "Users can update pins on own maps"
  ON public.map_pins
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_pins.map_id
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = map.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_pins.map_id
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = map.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

-- Policy: Users can delete pins on maps they own
CREATE POLICY "Users can delete pins on own maps"
  ON public.map_pins
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_pins.map_id
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = map.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_pins TO authenticated;
GRANT SELECT ON public.map_pins TO anon; -- Anonymous users can view pins on public maps

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE public.map_pins IS 'Point markers on custom maps with emoji, caption, image_url, and video_url';
COMMENT ON COLUMN public.map_pins.map_id IS 'Map this pin belongs to';
COMMENT ON COLUMN public.map_pins.emoji IS 'Emoji for the pin';
COMMENT ON COLUMN public.map_pins.caption IS 'Caption text for the pin';
COMMENT ON COLUMN public.map_pins.image_url IS 'Optional image URL for the pin';
COMMENT ON COLUMN public.map_pins.video_url IS 'Optional video URL for the pin';
COMMENT ON COLUMN public.map_pins.lat IS 'Latitude coordinate for pin location on map';
COMMENT ON COLUMN public.map_pins.lng IS 'Longitude coordinate for pin location on map';

-- ============================================================================
-- STEP 8: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
