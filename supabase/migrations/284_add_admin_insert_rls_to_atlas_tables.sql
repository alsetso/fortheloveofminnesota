-- Add admin INSERT RLS policies to all atlas tables
-- Allows users with admin role to create new atlas entities

-- ============================================================================
-- STEP 1: Enable RLS on all atlas tables (if not already enabled)
-- ============================================================================

ALTER TABLE atlas.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.parks ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.lakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.watertowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.cemeteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.golf_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.airports ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.municipals ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.roads ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.radio_and_news ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create admin INSERT policies for all atlas tables
-- ============================================================================

-- Neighborhoods
DROP POLICY IF EXISTS "admins_can_insert_neighborhoods" ON atlas.neighborhoods;
CREATE POLICY "admins_can_insert_neighborhoods"
  ON atlas.neighborhoods
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Schools
DROP POLICY IF EXISTS "admins_can_insert_schools" ON atlas.schools;
CREATE POLICY "admins_can_insert_schools"
  ON atlas.schools
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Parks
DROP POLICY IF EXISTS "admins_can_insert_parks" ON atlas.parks;
CREATE POLICY "admins_can_insert_parks"
  ON atlas.parks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Lakes
DROP POLICY IF EXISTS "admins_can_insert_lakes" ON atlas.lakes;
CREATE POLICY "admins_can_insert_lakes"
  ON atlas.lakes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Watertowers
DROP POLICY IF EXISTS "admins_can_insert_watertowers" ON atlas.watertowers;
CREATE POLICY "admins_can_insert_watertowers"
  ON atlas.watertowers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Cemeteries
DROP POLICY IF EXISTS "admins_can_insert_cemeteries" ON atlas.cemeteries;
CREATE POLICY "admins_can_insert_cemeteries"
  ON atlas.cemeteries
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Golf Courses
DROP POLICY IF EXISTS "admins_can_insert_golf_courses" ON atlas.golf_courses;
CREATE POLICY "admins_can_insert_golf_courses"
  ON atlas.golf_courses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Hospitals
DROP POLICY IF EXISTS "admins_can_insert_hospitals" ON atlas.hospitals;
CREATE POLICY "admins_can_insert_hospitals"
  ON atlas.hospitals
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Airports
DROP POLICY IF EXISTS "admins_can_insert_airports" ON atlas.airports;
CREATE POLICY "admins_can_insert_airports"
  ON atlas.airports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Churches
DROP POLICY IF EXISTS "admins_can_insert_churches" ON atlas.churches;
CREATE POLICY "admins_can_insert_churches"
  ON atlas.churches
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Municipals
DROP POLICY IF EXISTS "admins_can_insert_municipals" ON atlas.municipals;
CREATE POLICY "admins_can_insert_municipals"
  ON atlas.municipals
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Roads
DROP POLICY IF EXISTS "admins_can_insert_roads" ON atlas.roads;
CREATE POLICY "admins_can_insert_roads"
  ON atlas.roads
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Radio and News
DROP POLICY IF EXISTS "admins_can_insert_radio_and_news" ON atlas.radio_and_news;
CREATE POLICY "admins_can_insert_radio_and_news"
  ON atlas.radio_and_news
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================================
-- STEP 3: Grant INSERT permissions to authenticated users
-- (RLS policies will restrict to admins only)
-- ============================================================================

GRANT INSERT ON atlas.neighborhoods TO authenticated;
GRANT INSERT ON atlas.schools TO authenticated;
GRANT INSERT ON atlas.parks TO authenticated;
GRANT INSERT ON atlas.lakes TO authenticated;
GRANT INSERT ON atlas.watertowers TO authenticated;
GRANT INSERT ON atlas.cemeteries TO authenticated;
GRANT INSERT ON atlas.golf_courses TO authenticated;
GRANT INSERT ON atlas.hospitals TO authenticated;
GRANT INSERT ON atlas.airports TO authenticated;
GRANT INSERT ON atlas.churches TO authenticated;
GRANT INSERT ON atlas.municipals TO authenticated;
GRANT INSERT ON atlas.roads TO authenticated;
GRANT INSERT ON atlas.radio_and_news TO authenticated;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON POLICY "admins_can_insert_neighborhoods" ON atlas.neighborhoods IS 'Allows users with admin role to create new neighborhoods';
COMMENT ON POLICY "admins_can_insert_schools" ON atlas.schools IS 'Allows users with admin role to create new schools';
COMMENT ON POLICY "admins_can_insert_parks" ON atlas.parks IS 'Allows users with admin role to create new parks';
COMMENT ON POLICY "admins_can_insert_lakes" ON atlas.lakes IS 'Allows users with admin role to create new lakes';
COMMENT ON POLICY "admins_can_insert_watertowers" ON atlas.watertowers IS 'Allows users with admin role to create new watertowers';
COMMENT ON POLICY "admins_can_insert_cemeteries" ON atlas.cemeteries IS 'Allows users with admin role to create new cemeteries';
COMMENT ON POLICY "admins_can_insert_golf_courses" ON atlas.golf_courses IS 'Allows users with admin role to create new golf courses';
COMMENT ON POLICY "admins_can_insert_hospitals" ON atlas.hospitals IS 'Allows users with admin role to create new hospitals';
COMMENT ON POLICY "admins_can_insert_airports" ON atlas.airports IS 'Allows users with admin role to create new airports';
COMMENT ON POLICY "admins_can_insert_churches" ON atlas.churches IS 'Allows users with admin role to create new churches';
COMMENT ON POLICY "admins_can_insert_municipals" ON atlas.municipals IS 'Allows users with admin role to create new municipals';
COMMENT ON POLICY "admins_can_insert_roads" ON atlas.roads IS 'Allows users with admin role to create new roads';
COMMENT ON POLICY "admins_can_insert_radio_and_news" ON atlas.radio_and_news IS 'Allows users with admin role to create new radio and news entities';

-- ============================================================================
-- STEP 5: Create helper function for inserting atlas entities (for API routes)
-- ============================================================================

CREATE OR REPLACE FUNCTION atlas.insert_atlas_entity(
  p_table_name TEXT,
  p_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_schema TEXT := 'atlas';
  v_table TEXT;
  v_sql TEXT;
BEGIN
  -- Verify admin role
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create atlas entities';
  END IF;

  -- Map table name to actual table
  v_table := CASE p_table_name
    WHEN 'neighborhood' THEN 'neighborhoods'
    WHEN 'school' THEN 'schools'
    WHEN 'park' THEN 'parks'
    WHEN 'lake' THEN 'lakes'
    WHEN 'watertower' THEN 'watertowers'
    WHEN 'cemetery' THEN 'cemeteries'
    WHEN 'golf_course' THEN 'golf_courses'
    WHEN 'hospital' THEN 'hospitals'
    WHEN 'airport' THEN 'airports'
    WHEN 'church' THEN 'churches'
    WHEN 'municipal' THEN 'municipals'
    WHEN 'road' THEN 'roads'
    WHEN 'radio_and_news' THEN 'radio_and_news'
    ELSE NULL
  END;

  IF v_table IS NULL THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  -- Build and execute dynamic insert
  v_sql := format('INSERT INTO %I.%I SELECT * FROM jsonb_populate_record(null::%I.%I, $1) RETURNING to_jsonb(*)', 
    v_schema, v_table, v_schema, v_table);
  
  EXECUTE v_sql USING p_data INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION atlas.insert_atlas_entity IS 'Helper function for inserting atlas entities. Requires admin role.';

-- Grant execute permission to authenticated users (RLS will restrict to admins)
GRANT EXECUTE ON FUNCTION atlas.insert_atlas_entity TO authenticated;

