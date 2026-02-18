-- Spatial index so get_water_bbox can use GIST instead of full scan (fixes statement timeout)
-- Expression index: same expression must be used in the query for index use

CREATE INDEX IF NOT EXISTS layers_water_geom_gist
  ON layers.water
  USING GIST (CAST(ST_GeomFromGeoJSON(geometry::text) AS geography))
  WHERE geometry IS NOT NULL;

-- Recreate get_water_bbox to use && (bbox overlap) so the index is used; allow slightly longer timeout
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
DECLARE
  env geography := CAST(ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326) AS geography);
BEGIN
  SET LOCAL statement_timeout = '15s';
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
    AND CAST(ST_GeomFromGeoJSON(w.geometry::text) AS geography) && env
  ORDER BY w.gnis_name NULLS LAST, w.nhd_feature_id
  LIMIT p_limit;
EXCEPTION
  WHEN OTHERS THEN
    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_water_bbox(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO anon, authenticated;
