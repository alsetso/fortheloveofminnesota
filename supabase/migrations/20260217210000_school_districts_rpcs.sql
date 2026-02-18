-- RPC functions for layers.school_districts (explore + map)

-- Single record by id, or filter by sd_number
CREATE OR REPLACE FUNCTION public.get_school_districts(
  p_id UUID DEFAULT NULL,
  p_sd_number TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  sd_org_id TEXT,
  form_id TEXT,
  sd_type TEXT,
  sd_number TEXT,
  name TEXT,
  short_name TEXT,
  web_url TEXT,
  sq_miles NUMERIC,
  acres NUMERIC,
  geometry JSONB,
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
    s.id,
    s.sd_org_id,
    s.form_id,
    s.sd_type,
    s.sd_number,
    COALESCE(NULLIF(TRIM(s.name), ''), 'District ' || s.sd_number) AS name,
    s.short_name,
    s.web_url,
    s.sq_miles,
    s.acres,
    s.geometry,
    s.publisher,
    s.source_date
  FROM layers.school_districts s
  WHERE (p_id IS NULL OR s.id = p_id)
    AND (p_sd_number IS NULL OR s.sd_number = p_sd_number)
  ORDER BY s.name ASC NULLS LAST, s.sd_number
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_districts(UUID, TEXT, INTEGER) TO anon, authenticated;

-- Total count
CREATE OR REPLACE FUNCTION public.get_school_districts_count()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::BIGINT FROM layers.school_districts;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_districts_count() TO anon, authenticated;

-- Paginated list
CREATE OR REPLACE FUNCTION public.get_school_districts_paginated(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  sd_org_id TEXT,
  form_id TEXT,
  sd_type TEXT,
  sd_number TEXT,
  name TEXT,
  short_name TEXT,
  web_url TEXT,
  sq_miles NUMERIC,
  acres NUMERIC,
  geometry JSONB,
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
    s.id,
    s.sd_org_id,
    s.form_id,
    s.sd_type,
    s.sd_number,
    COALESCE(NULLIF(TRIM(s.name), ''), 'District ' || s.sd_number) AS name,
    s.short_name,
    s.web_url,
    s.sq_miles,
    s.acres,
    s.geometry,
    s.publisher,
    s.source_date
  FROM layers.school_districts s
  ORDER BY s.name ASC NULLS LAST, s.sd_number, s.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_districts_paginated(INTEGER, INTEGER) TO anon, authenticated;
