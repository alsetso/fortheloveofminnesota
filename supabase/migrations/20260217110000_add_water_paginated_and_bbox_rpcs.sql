-- Pagination and bbox queries for layers.water (10k+ lakes)

-- Total count for list pagination
CREATE OR REPLACE FUNCTION public.get_water_count()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::BIGINT FROM layers.water;
$$;

GRANT EXECUTE ON FUNCTION public.get_water_count() TO anon, authenticated;

-- Paginated list (same row shape as get_water, ordered by name)
CREATE OR REPLACE FUNCTION public.get_water_paginated(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  feature_type TEXT,
  nhd_feature_id TEXT,
  gnis_id TEXT,
  gnis_name TEXT,
  name TEXT,
  fcode INTEGER,
  ftype TEXT,
  geometry JSONB,
  description TEXT,
  publisher TEXT,
  source_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.feature_type,
    w.nhd_feature_id,
    w.gnis_id,
    w.gnis_name,
    COALESCE(NULLIF(TRIM(w.gnis_name), ''), w.nhd_feature_id, 'Unnamed water body') AS name,
    w.fcode,
    w.ftype,
    w.geometry,
    w.description,
    w.publisher,
    w.source_date
  FROM layers.water w
  ORDER BY COALESCE(NULLIF(TRIM(w.gnis_name), ''), w.nhd_feature_id, '') ASC NULLS LAST, w.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_water_paginated(INTEGER, INTEGER) TO anon, authenticated;

-- Bbox query for map view (PostGIS; only rows whose geometry intersects the envelope)
CREATE OR REPLACE FUNCTION public.get_water_bbox(
  p_min_lng DOUBLE PRECISION,
  p_min_lat DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_limit INTEGER DEFAULT 2000
)
RETURNS TABLE (
  id UUID,
  feature_type TEXT,
  nhd_feature_id TEXT,
  gnis_id TEXT,
  gnis_name TEXT,
  name TEXT,
  fcode INTEGER,
  ftype TEXT,
  geometry JSONB,
  description TEXT,
  publisher TEXT,
  source_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.feature_type,
    w.nhd_feature_id,
    w.gnis_id,
    w.gnis_name,
    COALESCE(NULLIF(TRIM(w.gnis_name), ''), w.nhd_feature_id, 'Unnamed water body') AS name,
    w.fcode,
    w.ftype,
    w.geometry,
    w.description,
    w.publisher,
    w.source_date
  FROM layers.water w
  WHERE w.geometry IS NOT NULL
    AND w.geometry::text IS NOT NULL
    AND ST_Intersects(
      ST_GeomFromGeoJSON(w.geometry::text)::geometry,
      ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
    )
  ORDER BY w.gnis_name NULLS LAST, w.nhd_feature_id
  LIMIT p_limit;
EXCEPTION
  WHEN OTHERS THEN
    -- Invalid GeoJSON or PostGIS error: return empty
    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_water_bbox(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO anon, authenticated;
