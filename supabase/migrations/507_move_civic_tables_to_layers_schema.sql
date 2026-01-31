-- Move civic boundary tables to layers schema with new names
-- Migrates: ctu_boundaries -> cities_and_towns, state_boundary -> state,
--           water_features -> water, county_boundaries -> counties,
--           congressional_districts -> districts

-- ============================================================================
-- STEP 1: Create layers schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS layers;

-- ============================================================================
-- STEP 2: Create new tables in layers schema with new names
-- ============================================================================

-- 2.1: cities_and_towns (from ctu_boundaries)
CREATE TABLE layers.cities_and_towns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ctu_class TEXT NOT NULL CHECK (ctu_class IN ('CITY', 'TOWNSHIP', 'UNORGANIZED TERRITORY')),
  feature_name TEXT NOT NULL,
  gnis_feature_id TEXT,
  county_name TEXT NOT NULL,
  county_code TEXT,
  county_gnis_feature_id TEXT,
  population INTEGER,
  acres NUMERIC(12, 2),
  geometry JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2: state (from state_boundary)
CREATE TABLE layers.state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Minnesota State Boundary',
  description TEXT,
  publisher TEXT,
  source_date DATE,
  geometry JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3: counties (from county_boundaries)
CREATE TABLE layers.counties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_name TEXT NOT NULL,
  county_code TEXT,
  county_gnis_feature_id TEXT,
  -- Optional reference to county entity (UUID only, no foreign key constraint)
  county_id UUID,
  description TEXT,
  publisher TEXT,
  source_date DATE,
  geometry JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4: water (from water_features)
CREATE TABLE layers.water (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_type TEXT NOT NULL CHECK (feature_type IN ('waterbody', 'flowline', 'area', 'line', 'point')),
  nhd_feature_id TEXT,
  gnis_id TEXT,
  gnis_name TEXT,
  fcode INTEGER,
  ftype TEXT,
  geometry JSONB NOT NULL,
  description TEXT,
  publisher TEXT DEFAULT 'Minnesota Department of Natural Resources',
  source_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5: districts (from congressional_districts)
CREATE TABLE layers.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_number INTEGER UNIQUE NOT NULL CHECK (district_number >= 1 AND district_number <= 8),
  name TEXT NOT NULL,
  description TEXT,
  publisher TEXT,
  date TEXT,
  xy_coordinate_resolution NUMERIC,
  geometry JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Copy all data from old tables to new tables
-- ============================================================================

INSERT INTO layers.cities_and_towns 
  (id, ctu_class, feature_name, gnis_feature_id, county_name, county_code, 
   county_gnis_feature_id, population, acres, geometry, created_at, updated_at)
SELECT 
  id, ctu_class, feature_name, gnis_feature_id, county_name, county_code,
  county_gnis_feature_id, population, acres, geometry, created_at, updated_at
FROM civic.ctu_boundaries;

INSERT INTO layers.state 
  (id, name, description, publisher, source_date, geometry, created_at, updated_at)
SELECT 
  id, name, description, publisher, source_date, geometry, created_at, updated_at
FROM civic.state_boundary;

INSERT INTO layers.counties 
  (id, county_name, county_code, county_gnis_feature_id, county_id, 
   description, publisher, source_date, geometry, created_at, updated_at)
SELECT 
  id, county_name, county_code, county_gnis_feature_id, county_id,
  description, publisher, source_date, geometry, created_at, updated_at
FROM civic.county_boundaries;

INSERT INTO layers.water 
  (id, feature_type, nhd_feature_id, gnis_id, gnis_name, fcode, ftype,
   geometry, description, publisher, source_date, created_at, updated_at)
SELECT 
  id, feature_type, nhd_feature_id, gnis_id, gnis_name, fcode, ftype,
  geometry, description, publisher, source_date, created_at, updated_at
FROM civic.water_features;

INSERT INTO layers.districts 
  (id, district_number, name, description, publisher, date, 
   xy_coordinate_resolution, geometry, created_at, updated_at)
SELECT 
  id, district_number, name, description, publisher, date,
  xy_coordinate_resolution, geometry, created_at, updated_at
FROM civic.congressional_districts;

-- ============================================================================
-- STEP 4: Create indexes for new tables
-- ============================================================================

-- Indexes for cities_and_towns
CREATE INDEX IF NOT EXISTS idx_cities_and_towns_ctu_class 
  ON layers.cities_and_towns(ctu_class);
CREATE INDEX IF NOT EXISTS idx_cities_and_towns_feature_name 
  ON layers.cities_and_towns(feature_name);
CREATE INDEX IF NOT EXISTS idx_cities_and_towns_gnis_feature_id 
  ON layers.cities_and_towns(gnis_feature_id) 
  WHERE gnis_feature_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_and_towns_gnis_unique 
  ON layers.cities_and_towns(gnis_feature_id) 
  WHERE gnis_feature_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cities_and_towns_county_name 
  ON layers.cities_and_towns(county_name);
CREATE INDEX IF NOT EXISTS idx_cities_and_towns_county_code 
  ON layers.cities_and_towns(county_code)
  WHERE county_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cities_and_towns_geometry 
  ON layers.cities_and_towns USING GIN (geometry) 
  WHERE geometry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cities_and_towns_class_county 
  ON layers.cities_and_towns(ctu_class, county_name);

-- Full-text search index for feature names (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_cities_and_towns_feature_name_lower 
  ON layers.cities_and_towns(LOWER(feature_name));

-- Indexes for state
CREATE INDEX IF NOT EXISTS idx_state_geometry 
  ON layers.state USING GIN (geometry) 
  WHERE geometry IS NOT NULL;

-- Indexes for counties
CREATE INDEX IF NOT EXISTS idx_counties_county_name 
  ON layers.counties(county_name);
CREATE INDEX IF NOT EXISTS idx_counties_county_name_lower 
  ON layers.counties(LOWER(county_name));
CREATE INDEX IF NOT EXISTS idx_counties_county_code 
  ON layers.counties(county_code)
  WHERE county_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_counties_county_id 
  ON layers.counties(county_id)
  WHERE county_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_counties_gnis_feature_id 
  ON layers.counties(county_gnis_feature_id) 
  WHERE county_gnis_feature_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_counties_geometry 
  ON layers.counties USING GIN (geometry) 
  WHERE geometry IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_counties_county_name_unique 
  ON layers.counties(county_name);

-- Indexes for water
CREATE INDEX IF NOT EXISTS idx_water_feature_type 
  ON layers.water(feature_type);
CREATE INDEX IF NOT EXISTS idx_water_nhd_feature_id 
  ON layers.water(nhd_feature_id)
  WHERE nhd_feature_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_water_gnis_id 
  ON layers.water(gnis_id)
  WHERE gnis_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_water_fcode 
  ON layers.water(fcode)
  WHERE fcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_water_geometry 
  ON layers.water USING GIN (geometry) 
  WHERE geometry IS NOT NULL;

-- Indexes for districts
CREATE INDEX IF NOT EXISTS idx_districts_number 
  ON layers.districts(district_number);
CREATE INDEX IF NOT EXISTS idx_districts_geometry 
  ON layers.districts USING GIN (geometry) 
  WHERE geometry IS NOT NULL;

-- ============================================================================
-- STEP 5: Create updated_at triggers
-- ============================================================================

CREATE TRIGGER update_cities_and_towns_updated_at
  BEFORE UPDATE ON layers.cities_and_towns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_state_updated_at
  BEFORE UPDATE ON layers.state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_counties_updated_at
  BEFORE UPDATE ON layers.counties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_water_updated_at
  BEFORE UPDATE ON layers.water
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_districts_updated_at
  BEFORE UPDATE ON layers.districts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON TABLE layers.cities_and_towns IS 
  'Minnesota City, Township, and Unorganized Territory boundaries as GeoJSON FeatureCollections. Source: MnDOT/MnGeo';
COMMENT ON TABLE layers.state IS 
  'Minnesota state boundary as GeoJSON FeatureCollection. Source: MNDNR';
COMMENT ON TABLE layers.counties IS 
  'Minnesota county boundaries as GeoJSON FeatureCollections. Source: MNDNR';
COMMENT ON COLUMN layers.counties.county_id IS 
  'Optional UUID reference to county entity (no foreign key constraint)';
COMMENT ON TABLE layers.water IS 
  'Minnesota water features from National Hydrography Dataset (NHD). Source: MNDNR';
COMMENT ON TABLE layers.districts IS 
  'Minnesota congressional districts with voting precinct boundaries as GeoJSON FeatureCollections';
COMMENT ON COLUMN layers.districts.date IS 
  'Date as text from source metadata (e.g., "April 1,2025") - kept as TEXT to preserve original format';

-- ============================================================================
-- STEP 7: Enable Row Level Security
-- ============================================================================

ALTER TABLE layers.cities_and_towns ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers.state ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers.counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers.water ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers.districts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cities_and_towns
CREATE POLICY "Anyone can view cities and towns"
  ON layers.cities_and_towns FOR SELECT TO authenticated, anon 
  USING (true);
CREATE POLICY "Admins can insert cities and towns"
  ON layers.cities_and_towns FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update cities and towns"
  ON layers.cities_and_towns FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete cities and towns"
  ON layers.cities_and_towns FOR DELETE TO authenticated
  USING (public.is_admin());
CREATE POLICY "Service role can manage cities and towns"
  ON layers.cities_and_towns FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

-- RLS Policies for state
CREATE POLICY "Anyone can view state"
  ON layers.state FOR SELECT TO authenticated, anon 
  USING (true);
CREATE POLICY "Admins can insert state"
  ON layers.state FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update state"
  ON layers.state FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete state"
  ON layers.state FOR DELETE TO authenticated
  USING (public.is_admin());
CREATE POLICY "Service role can manage state"
  ON layers.state FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

-- RLS Policies for counties
CREATE POLICY "Anyone can view counties"
  ON layers.counties FOR SELECT TO authenticated, anon 
  USING (true);
CREATE POLICY "Admins can insert counties"
  ON layers.counties FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update counties"
  ON layers.counties FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete counties"
  ON layers.counties FOR DELETE TO authenticated
  USING (public.is_admin());
CREATE POLICY "Service role can manage counties"
  ON layers.counties FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

-- RLS Policies for water
CREATE POLICY "Anyone can view water"
  ON layers.water FOR SELECT TO authenticated, anon 
  USING (true);
CREATE POLICY "Admins can insert water"
  ON layers.water FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update water"
  ON layers.water FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete water"
  ON layers.water FOR DELETE TO authenticated
  USING (public.is_admin());
CREATE POLICY "Service role can manage water"
  ON layers.water FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

-- RLS Policies for districts
CREATE POLICY "Anyone can view districts"
  ON layers.districts FOR SELECT TO authenticated, anon 
  USING (true);
CREATE POLICY "Admins can insert districts"
  ON layers.districts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update districts"
  ON layers.districts FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete districts"
  ON layers.districts FOR DELETE TO authenticated
  USING (public.is_admin());
CREATE POLICY "Service role can manage districts"
  ON layers.districts FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA layers TO service_role;
GRANT SELECT ON layers.cities_and_towns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON layers.cities_and_towns TO authenticated;
GRANT ALL ON layers.cities_and_towns TO service_role;

GRANT SELECT ON layers.state TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON layers.state TO authenticated;
GRANT ALL ON layers.state TO service_role;

GRANT SELECT ON layers.counties TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON layers.counties TO authenticated;
GRANT ALL ON layers.counties TO service_role;

GRANT SELECT ON layers.water TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON layers.water TO authenticated;
GRANT ALL ON layers.water TO service_role;

GRANT SELECT ON layers.districts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON layers.districts TO authenticated;
GRANT ALL ON layers.districts TO service_role;

-- ============================================================================
-- STEP 9: Update public schema views to point to new tables
-- ============================================================================

CREATE OR REPLACE VIEW public.ctu_boundaries AS 
  SELECT * FROM layers.cities_and_towns;
GRANT SELECT ON public.ctu_boundaries TO anon, authenticated;
GRANT ALL ON public.ctu_boundaries TO service_role;

CREATE OR REPLACE VIEW public.state_boundary AS 
  SELECT * FROM layers.state;
GRANT SELECT ON public.state_boundary TO anon, authenticated;
GRANT ALL ON public.state_boundary TO service_role;

CREATE OR REPLACE VIEW public.county_boundaries AS 
  SELECT * FROM layers.counties;
GRANT SELECT ON public.county_boundaries TO anon, authenticated;
GRANT ALL ON public.county_boundaries TO service_role;

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
FROM layers.water;
GRANT SELECT ON public.water_features TO authenticated, anon;

CREATE OR REPLACE VIEW public.congressional_districts AS 
  SELECT * FROM layers.districts;
GRANT SELECT ON public.congressional_districts TO anon, authenticated;
GRANT ALL ON public.congressional_districts TO service_role;

-- ============================================================================
-- STEP 10: Drop old tables from civic schema
-- ============================================================================

DROP TABLE IF EXISTS civic.congressional_districts CASCADE;
DROP TABLE IF EXISTS civic.water_features CASCADE;
DROP TABLE IF EXISTS civic.county_boundaries CASCADE;
DROP TABLE IF EXISTS civic.state_boundary CASCADE;
DROP TABLE IF EXISTS civic.ctu_boundaries CASCADE;
