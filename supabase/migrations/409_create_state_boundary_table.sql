-- Create civic.state_boundary table
-- Stores Minnesota state boundary as GeoJSON FeatureCollection
-- Source: Minnesota Department of Natural Resources (MNDNR)

-- ============================================================================
-- STEP 1: Create table
-- ============================================================================

CREATE TABLE IF NOT EXISTS civic.state_boundary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadata
  name TEXT NOT NULL DEFAULT 'Minnesota State Boundary',
  description TEXT,
  publisher TEXT,
  source_date DATE,
  
  -- Geometry (GeoJSON FeatureCollection)
  geometry JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_state_boundary_geometry 
  ON civic.state_boundary USING GIN (geometry) 
  WHERE geometry IS NOT NULL;

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_state_boundary_updated_at
  BEFORE UPDATE ON civic.state_boundary
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON TABLE civic.state_boundary IS 
  'Minnesota state boundary as GeoJSON FeatureCollection. Source: MNDNR';

COMMENT ON COLUMN civic.state_boundary.name IS 
  'Name of the boundary (default: "Minnesota State Boundary")';

COMMENT ON COLUMN civic.state_boundary.geometry IS 
  'GeoJSON FeatureCollection containing the state boundary polygon';

COMMENT ON COLUMN civic.state_boundary.publisher IS 
  'Publisher of the data (e.g., "Minnesota Department of Natural Resources")';

COMMENT ON COLUMN civic.state_boundary.source_date IS 
  'Date when the source data was published';

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE civic.state_boundary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view state boundary"
  ON civic.state_boundary FOR SELECT TO authenticated, anon 
  USING (true);

CREATE POLICY "Admins can insert state boundary"
  ON civic.state_boundary FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update state boundary"
  ON civic.state_boundary FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete state boundary"
  ON civic.state_boundary FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Service role can manage state boundary"
  ON civic.state_boundary FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA civic TO service_role;

GRANT SELECT ON civic.state_boundary TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON civic.state_boundary TO authenticated;
GRANT ALL ON civic.state_boundary TO service_role;

-- ============================================================================
-- STEP 7: Create public schema view for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.state_boundary AS 
  SELECT * FROM civic.state_boundary;

-- Grant permissions on public view
GRANT SELECT ON public.state_boundary TO anon, authenticated;
GRANT ALL ON public.state_boundary TO service_role;

