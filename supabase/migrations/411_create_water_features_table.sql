-- Create civic.water_features table
-- Stores Minnesota water features from National Hydrography Dataset (NHD)
-- Source: Minnesota Department of Natural Resources (MNDNR)

-- ============================================================================
-- STEP 1: Create table
-- ============================================================================

CREATE TABLE IF NOT EXISTS civic.water_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Feature Identification
  feature_type TEXT NOT NULL CHECK (feature_type IN ('waterbody', 'flowline', 'area', 'line', 'point')),
  nhd_feature_id TEXT,
  gnis_id TEXT,
  gnis_name TEXT,
  
  -- Feature Classification
  fcode INTEGER, -- NHD Feature Code
  ftype TEXT,    -- NHD Feature Type
  
  -- Geometry (GeoJSON FeatureCollection)
  geometry JSONB NOT NULL,
  
  -- Metadata
  description TEXT,
  publisher TEXT DEFAULT 'Minnesota Department of Natural Resources',
  source_date DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_water_features_feature_type 
  ON civic.water_features(feature_type);

CREATE INDEX IF NOT EXISTS idx_water_features_nhd_feature_id 
  ON civic.water_features(nhd_feature_id)
  WHERE nhd_feature_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_water_features_gnis_id 
  ON civic.water_features(gnis_id)
  WHERE gnis_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_water_features_fcode 
  ON civic.water_features(fcode)
  WHERE fcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_water_features_geometry 
  ON civic.water_features USING GIN (geometry) 
  WHERE geometry IS NOT NULL;

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_water_features_updated_at
  BEFORE UPDATE ON civic.water_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON TABLE civic.water_features IS 
  'Minnesota water features from National Hydrography Dataset (NHD). Source: MNDNR';

COMMENT ON COLUMN civic.water_features.feature_type IS 
  'Type of water feature: waterbody, flowline, area, line, or point';

COMMENT ON COLUMN civic.water_features.nhd_feature_id IS 
  'NHD permanent identifier';

COMMENT ON COLUMN civic.water_features.gnis_id IS 
  'Geographic Names Information System identifier';

COMMENT ON COLUMN civic.water_features.fcode IS 
  'NHD Feature Code';

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE civic.water_features ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view water features"
  ON civic.water_features
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Admin write access
CREATE POLICY "Admins can insert water features"
  ON civic.water_features
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'admin'
    )
  );

CREATE POLICY "Admins can update water features"
  ON civic.water_features
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete water features"
  ON civic.water_features
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 6: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.water_features AS
SELECT 
  id,
  feature_type,
  nhd_feature_id,
  gnis_id,
  gnis_name,
  fcode,
  ftype,
  geometry,
  description,
  publisher,
  source_date,
  created_at,
  updated_at
FROM civic.water_features;

-- Grant access to view
GRANT SELECT ON public.water_features TO authenticated, anon;

