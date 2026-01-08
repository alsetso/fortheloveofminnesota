-- Create civic.ctu_boundaries table
-- Stores Minnesota City, Township, and Unorganized Territory boundaries as GeoJSON FeatureCollections
-- Source: Minnesota Department of Transportation (MnDOT) / Minnesota Geospatial Information Office (MnGeo)

-- ============================================================================
-- STEP 1: Create table
-- ============================================================================

CREATE TABLE IF NOT EXISTS civic.ctu_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- CTU Classification
  ctu_class TEXT NOT NULL CHECK (ctu_class IN ('CITY', 'TOWNSHIP', 'UNORGANIZED TERRITORY')),
  
  -- Feature Identification
  feature_name TEXT NOT NULL,
  gnis_feature_id TEXT,
  
  -- County Information
  county_name TEXT NOT NULL,
  county_code TEXT,
  county_gnis_feature_id TEXT,
  
  -- Demographics
  population INTEGER,
  acres NUMERIC(12, 2), -- Calculated from geometry during import
  
  -- Geometry (GeoJSON FeatureCollection)
  geometry JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ctu_boundaries_ctu_class 
  ON civic.ctu_boundaries(ctu_class);

CREATE INDEX IF NOT EXISTS idx_ctu_boundaries_feature_name 
  ON civic.ctu_boundaries(feature_name);

CREATE INDEX IF NOT EXISTS idx_ctu_boundaries_gnis_feature_id 
  ON civic.ctu_boundaries(gnis_feature_id) 
  WHERE gnis_feature_id IS NOT NULL;

-- Unique constraint on GNIS ID (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ctu_boundaries_gnis_unique 
  ON civic.ctu_boundaries(gnis_feature_id) 
  WHERE gnis_feature_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ctu_boundaries_county_name 
  ON civic.ctu_boundaries(county_name);

CREATE INDEX IF NOT EXISTS idx_ctu_boundaries_county_code 
  ON civic.ctu_boundaries(county_code)
  WHERE county_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ctu_boundaries_geometry 
  ON civic.ctu_boundaries USING GIN (geometry) 
  WHERE geometry IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_ctu_boundaries_class_county 
  ON civic.ctu_boundaries(ctu_class, county_name);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_ctu_boundaries_updated_at
  BEFORE UPDATE ON civic.ctu_boundaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON TABLE civic.ctu_boundaries IS 
  'Minnesota City, Township, and Unorganized Territory boundaries as GeoJSON FeatureCollections. Source: MnDOT/MnGeo';

COMMENT ON COLUMN civic.ctu_boundaries.ctu_class IS 
  'Type of CTU: CITY, TOWNSHIP, or UNORGANIZED TERRITORY';

COMMENT ON COLUMN civic.ctu_boundaries.feature_name IS 
  'Name of the city, township, or unorganized territory';

COMMENT ON COLUMN civic.ctu_boundaries.gnis_feature_id IS 
  'Geographic Names Information System (GNIS) Feature Identification Number';

COMMENT ON COLUMN civic.ctu_boundaries.county_name IS 
  'Name of the Minnesota county containing this CTU';

COMMENT ON COLUMN civic.ctu_boundaries.county_code IS 
  'Minnesota county code';

COMMENT ON COLUMN civic.ctu_boundaries.county_gnis_feature_id IS 
  'Geographic Names Information System (GNIS) County Feature ID';

COMMENT ON COLUMN civic.ctu_boundaries.geometry IS 
  'GeoJSON FeatureCollection containing the boundary polygon(s)';

COMMENT ON COLUMN civic.ctu_boundaries.population IS 
  'Population for the CTU (where available from MN State Demographic Center)';

COMMENT ON COLUMN civic.ctu_boundaries.acres IS 
  'Number of acres within the CTU boundary';

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE civic.ctu_boundaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view CTU boundaries"
  ON civic.ctu_boundaries FOR SELECT TO authenticated, anon 
  USING (true);

CREATE POLICY "Admins can insert CTU boundaries"
  ON civic.ctu_boundaries FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update CTU boundaries"
  ON civic.ctu_boundaries FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete CTU boundaries"
  ON civic.ctu_boundaries FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Service role can manage CTU boundaries"
  ON civic.ctu_boundaries FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA civic TO service_role;

GRANT SELECT ON civic.ctu_boundaries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON civic.ctu_boundaries TO authenticated;
GRANT ALL ON civic.ctu_boundaries TO service_role;

-- ============================================================================
-- STEP 7: Create public schema view for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.ctu_boundaries AS 
  SELECT * FROM civic.ctu_boundaries;

-- Grant permissions on public view
GRANT SELECT ON public.ctu_boundaries TO anon, authenticated;
GRANT ALL ON public.ctu_boundaries TO service_role;

