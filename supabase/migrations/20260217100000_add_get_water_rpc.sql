-- RPC to query layers.water for explore and map
CREATE OR REPLACE FUNCTION public.get_water(
  p_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 5000
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
  WHERE (p_id IS NULL OR w.id = p_id)
  ORDER BY w.gnis_name NULLS LAST, w.nhd_feature_id
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_water(UUID, INTEGER) TO anon, authenticated;
