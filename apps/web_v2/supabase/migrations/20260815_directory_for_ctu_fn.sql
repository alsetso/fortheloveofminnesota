-- Directory pages for a CTU: direct city_id match + PostGIS boundary fallback
-- Used by /api/territory/units/[id]/directory

CREATE OR REPLACE FUNCTION public.get_directory_pages_for_ctu(
  p_ctu_id    uuid,
  p_query     text    DEFAULT '',
  p_excl_ids  uuid[]  DEFAULT '{}',
  p_limit     int     DEFAULT 40
)
RETURNS TABLE (
  id               uuid,
  slug             text,
  title            text,
  icon             text,
  cover_url        text,
  page_type        text,
  description      text,
  address_line     text,
  website          text,
  lat              double precision,
  lng              double precision,
  is_verified      boolean,
  quality_score    integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = extensions, public, pg_catalog
AS $$
  SELECT
    p.id,
    p.slug,
    p.title,
    p.icon,
    p.cover_url,
    p.page_type,
    p.description,
    p.address_line,
    p.website,
    p.lat,
    p.lng,
    p.is_verified,
    p.quality_score
  FROM page.pages p
  CROSS JOIN (
    SELECT (geometry_simplified->'features'->0->'geometry') AS geom
    FROM territory.cities_and_towns
    WHERE id = p_ctu_id
  ) ctu
  WHERE p.status   = 'active'
    AND p.visibility = 'public'
    AND p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND NOT (p.id = ANY(p_excl_ids))
    AND ST_Within(
      ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326),
      ST_SetSRID(ST_GeomFromGeoJSON(ctu.geom::text), 4326)
    )
    AND (
      p_query = ''
      OR p.title       ILIKE '%' || p_query || '%'
      OR p.description ILIKE '%' || p_query || '%'
      OR p.address_line ILIKE '%' || p_query || '%'
    )
  ORDER BY p.quality_score DESC NULLS LAST, p.title ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_directory_pages_for_ctu(uuid, text, uuid[], int)
  TO service_role, authenticated, anon;
