-- Create map_areas table
-- Simple polygons that connect to maps with GeoJSON coordinates

-- ============================================================================
-- STEP 1: Create map_areas table
-- ============================================================================

CREATE TABLE public.map_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Polygon geometry: GeoJSON Polygon or MultiPolygon
  geometry JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

CREATE INDEX idx_map_areas_map_id ON public.map_areas(map_id);
CREATE INDEX idx_map_areas_created_at ON public.map_areas(created_at DESC);

-- Create GIN index for geometry queries
CREATE INDEX idx_map_areas_geometry ON public.map_areas USING GIN (geometry);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_map_areas_updated_at
  BEFORE UPDATE ON public.map_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.map_areas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies
-- ============================================================================

-- Policy: Users can view areas on maps they can access
CREATE POLICY "Users can view areas on accessible maps"
  ON public.map_areas
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_areas.map_id
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

-- Policy: Authenticated users can create areas on maps they can access
CREATE POLICY "Users can create areas on accessible maps"
  ON public.map_areas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_areas.map_id
      AND (
        -- Map owner can always post
        EXISTS (
          SELECT 1 FROM public.accounts
          WHERE accounts.id = map.account_id
          AND accounts.user_id = auth.uid()
        )
        OR
        -- Public maps allow anyone to post
        map.visibility = 'public'
      )
    )
  );

-- Policy: Users can update areas on maps they own
CREATE POLICY "Users can update areas on own maps"
  ON public.map_areas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_areas.map_id
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
      WHERE map.id = map_areas.map_id
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = map.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

-- Policy: Users can delete areas on maps they own
CREATE POLICY "Users can delete areas on own maps"
  ON public.map_areas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_areas.map_id
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_areas TO authenticated;
GRANT SELECT ON public.map_areas TO anon; -- Anonymous users can view areas on public maps

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE public.map_areas IS 'Polygon areas on maps with GeoJSON coordinates';
COMMENT ON COLUMN public.map_areas.map_id IS 'Map this area belongs to';
COMMENT ON COLUMN public.map_areas.name IS 'Name of the area';
COMMENT ON COLUMN public.map_areas.description IS 'Optional description of the area';
COMMENT ON COLUMN public.map_areas.geometry IS 'GeoJSON geometry (Polygon or MultiPolygon). Format: {"type": "Polygon", "coordinates": [[[lng, lat], ...]]}';

