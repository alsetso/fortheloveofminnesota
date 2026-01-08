-- Create civic.congressional_districts table
-- Stores Minnesota congressional district boundaries as GeoJSON FeatureCollections

-- ============================================================================
-- STEP 1: Create table
-- ============================================================================

CREATE TABLE IF NOT EXISTS civic.congressional_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_number INTEGER UNIQUE NOT NULL CHECK (district_number >= 1 AND district_number <= 8),
  name TEXT NOT NULL,
  description TEXT,
  publisher TEXT,
  date TEXT,
  xy_coordinate_resolution NUMERIC,
  
  -- Full GeoJSON FeatureCollection with all precincts
  geometry JSONB NOT NULL,
  
  -- PostGIS geometry for spatial queries (optional, can be added later)
  -- geometry_postgis GEOMETRY(MULTIPOLYGON, 4326),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_congressional_districts_number 
  ON civic.congressional_districts(district_number);

CREATE INDEX IF NOT EXISTS idx_congressional_districts_geometry 
  ON civic.congressional_districts USING GIN (geometry) 
  WHERE geometry IS NOT NULL;

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_congressional_districts_updated_at
  BEFORE UPDATE ON civic.congressional_districts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON TABLE civic.congressional_districts IS 
  'Minnesota congressional districts with voting precinct boundaries as GeoJSON FeatureCollections';

COMMENT ON COLUMN civic.congressional_districts.district_number IS 
  'Congressional district number (1-8)';

COMMENT ON COLUMN civic.congressional_districts.geometry IS 
  'Full GeoJSON FeatureCollection containing all voting precincts for this district';

COMMENT ON COLUMN civic.congressional_districts.name IS 
  'Name from GeoJSON metadata (e.g., "precincts")';

COMMENT ON COLUMN civic.congressional_districts.description IS 
  'Description from GeoJSON metadata';

COMMENT ON COLUMN civic.congressional_districts.publisher IS 
  'Publisher from GeoJSON metadata (e.g., "Office of the Minnesota Secretary of State Elections Division")';

COMMENT ON COLUMN civic.congressional_districts.date IS 
  'Date from GeoJSON metadata (e.g., "April 1,2025")';

COMMENT ON COLUMN civic.congressional_districts.xy_coordinate_resolution IS 
  'Coordinate precision from GeoJSON metadata (e.g., 0.0001)';

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE civic.congressional_districts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view congressional districts"
  ON civic.congressional_districts FOR SELECT TO authenticated, anon 
  USING (true);

CREATE POLICY "Admins can insert congressional districts"
  ON civic.congressional_districts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update congressional districts"
  ON civic.congressional_districts FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete congressional districts"
  ON civic.congressional_districts FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Service role can manage congressional districts"
  ON civic.congressional_districts FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA civic TO service_role;

GRANT SELECT ON civic.congressional_districts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON civic.congressional_districts TO authenticated;
GRANT ALL ON civic.congressional_districts TO service_role;

-- ============================================================================
-- STEP 7: Create public schema view for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.congressional_districts AS 
  SELECT * FROM civic.congressional_districts;

-- Grant permissions on public view
GRANT SELECT ON public.congressional_districts TO anon, authenticated;
GRANT ALL ON public.congressional_districts TO service_role;

