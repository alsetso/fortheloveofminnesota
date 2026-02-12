-- Create public RPC functions to query layers schema tables
-- These are public resources, so we expose them via RPC functions

-- Drop existing functions if they exist with wrong signatures
DROP FUNCTION IF EXISTS public.get_ctu_boundaries CASCADE;
DROP FUNCTION IF EXISTS public.get_counties CASCADE;
DROP FUNCTION IF EXISTS public.get_congressional_districts CASCADE;
DROP FUNCTION IF EXISTS public.get_state_boundary CASCADE;

-- Function to get counties
CREATE OR REPLACE FUNCTION public.get_counties(
  p_id UUID DEFAULT NULL,
  p_county_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  county_name TEXT,
  county_code TEXT,
  county_gnis_feature_id TEXT,
  county_id UUID,
  description TEXT,
  publisher TEXT,
  source_date DATE,
  geometry JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.county_name,
    c.county_code,
    c.county_gnis_feature_id,
    c.county_id,
    c.description,
    c.publisher,
    c.source_date,
    c.geometry
  FROM layers.counties c
  WHERE (p_id IS NULL OR c.id = p_id)
    AND (p_county_name IS NULL OR c.county_name = p_county_name)
  ORDER BY c.county_name ASC
  LIMIT p_limit;
END;
$$;

-- Function to get CTU boundaries
CREATE OR REPLACE FUNCTION public.get_ctu_boundaries(
  p_id UUID DEFAULT NULL,
  p_ctu_class TEXT DEFAULT NULL,
  p_county_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  ctu_class TEXT,
  feature_name TEXT,
  gnis_feature_id TEXT,
  county_name TEXT,
  county_code TEXT,
  county_gnis_feature_id TEXT,
  population INTEGER,
  acres NUMERIC,
  geometry JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.ctu_class,
    c.feature_name,
    c.gnis_feature_id,
    c.county_name,
    c.county_code,
    c.county_gnis_feature_id,
    c.population,
    c.acres,
    c.geometry
  FROM layers.cities_and_towns c
  WHERE (p_id IS NULL OR c.id = p_id)
    AND (p_ctu_class IS NULL OR c.ctu_class = p_ctu_class)
    AND (p_county_name IS NULL OR c.county_name = p_county_name)
  ORDER BY c.ctu_class ASC, c.feature_name ASC
  LIMIT p_limit;
END;
$$;

-- Function to get congressional districts
CREATE OR REPLACE FUNCTION public.get_congressional_districts(
  p_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  district_number INTEGER,
  name TEXT,
  geometry JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.district_number,
    d.name,
    d.geometry
  FROM layers.districts d
  WHERE (p_id IS NULL OR d.id = p_id)
  ORDER BY d.district_number ASC
  LIMIT p_limit;
END;
$$;

-- Function to get state boundary
CREATE OR REPLACE FUNCTION public.get_state_boundary()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  publisher TEXT,
  source_date DATE,
  geometry JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.description,
    s.publisher,
    s.source_date,
    s.geometry
  FROM layers.state s
  LIMIT 1;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_counties(UUID, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ctu_boundaries(UUID, TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_congressional_districts(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_state_boundary() TO anon, authenticated;
