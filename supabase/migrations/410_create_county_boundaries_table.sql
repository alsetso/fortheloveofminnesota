-- Create civic.county_boundaries table
-- Stores Minnesota county boundaries as GeoJSON FeatureCollections
-- Source: Minnesota Department of Natural Resources (MNDNR)

-- ============================================================================
-- STEP 1: Create table
-- ============================================================================

CREATE TABLE IF NOT EXISTS civic.county_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- County Identification
  county_name TEXT NOT NULL,
  county_code TEXT,
  county_gnis_feature_id TEXT,
  
  -- Optional link to atlas.counties
  county_id UUID REFERENCES atlas.counties(id) ON DELETE SET NULL,
  
  -- Metadata
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

CREATE INDEX IF NOT EXISTS idx_county_boundaries_county_name 
  ON civic.county_boundaries(county_name);

CREATE INDEX IF NOT EXISTS idx_county_boundaries_county_code 
  ON civic.county_boundaries(county_code)
  WHERE county_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_county_boundaries_county_id 
  ON civic.county_boundaries(county_id)
  WHERE county_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_county_boundaries_gnis_feature_id 
  ON civic.county_boundaries(county_gnis_feature_id) 
  WHERE county_gnis_feature_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_county_boundaries_geometry 
  ON civic.county_boundaries USING GIN (geometry) 
  WHERE geometry IS NOT NULL;

-- Unique constraint on county name
CREATE UNIQUE INDEX IF NOT EXISTS idx_county_boundaries_county_name_unique 
  ON civic.county_boundaries(county_name);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_county_boundaries_updated_at
  BEFORE UPDATE ON civic.county_boundaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON TABLE civic.county_boundaries IS 
  'Minnesota county boundaries as GeoJSON FeatureCollections. Source: MNDNR';

COMMENT ON COLUMN civic.county_boundaries.county_name IS 
  'Name of the Minnesota county';

COMMENT ON COLUMN civic.county_boundaries.county_code IS 
  'Minnesota county code';

COMMENT ON COLUMN civic.county_boundaries.county_id IS 
  'Optional foreign key to atlas.counties table';

COMMENT ON COLUMN civic.county_boundaries.county_gnis_feature_id IS 
  'Geographic Names Information System (GNIS) County Feature ID';

COMMENT ON COLUMN civic.county_boundaries.geometry IS 
  'GeoJSON FeatureCollection containing the county boundary polygon(s)';

COMMENT ON COLUMN civic.county_boundaries.publisher IS 
  'Publisher of the data (e.g., "Minnesota Department of Natural Resources")';

COMMENT ON COLUMN civic.county_boundaries.source_date IS 
  'Date when the source data was published';

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE civic.county_boundaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view county boundaries"
  ON civic.county_boundaries FOR SELECT TO authenticated, anon 
  USING (true);

CREATE POLICY "Admins can insert county boundaries"
  ON civic.county_boundaries FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update county boundaries"
  ON civic.county_boundaries FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete county boundaries"
  ON civic.county_boundaries FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Service role can manage county boundaries"
  ON civic.county_boundaries FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA civic TO service_role;

GRANT SELECT ON civic.county_boundaries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON civic.county_boundaries TO authenticated;
GRANT ALL ON civic.county_boundaries TO service_role;

-- ============================================================================
-- STEP 7: Create public schema view for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.county_boundaries AS 
  SELECT * FROM civic.county_boundaries;

-- Grant permissions on public view
GRANT SELECT ON public.county_boundaries TO anon, authenticated;
GRANT ALL ON public.county_boundaries TO service_role;

