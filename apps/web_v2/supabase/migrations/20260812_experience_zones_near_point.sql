-- Approach detection: active primary experience zones within radius of a point,
-- excluding zones that already cover the point (those use experience_zone_at_point).

CREATE OR REPLACE FUNCTION public.experience_zones_near_point(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision DEFAULT 350
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'world', 'extensions'
AS $$
DECLARE
  v_point geography;
  v_radius double precision;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('zones', '[]'::jsonb);
  END IF;

  v_radius := GREATEST(50::double precision, LEAST(COALESCE(p_radius_m, 350), 2000::double precision));
  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  SELECT COALESCE(
    jsonb_agg(row_to_json(q)::jsonb ORDER BY q.distance_m ASC),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      z.id,
      z.slug,
      z.name,
      z.description,
      ROUND(ST_Distance(z.geom, v_point)::numeric, 1) AS distance_m,
      ST_X(ST_ClosestPoint(z.geom::geometry, v_point::geometry)) AS label_lng,
      ST_Y(ST_ClosestPoint(z.geom::geometry, v_point::geometry)) AS label_lat,
      COALESCE(
        z.geometry_simplified,
        ST_AsGeoJSON(z.geom::geometry)::jsonb
      ) AS geometry
    FROM world.experience_zones z
    WHERE z.status = 'active'
      AND z.parent_zone_id IS NULL
      AND NOT ST_Covers(z.geom, v_point)
      AND ST_DWithin(z.geom, v_point, v_radius)
    ORDER BY ST_Distance(z.geom, v_point) ASC
    LIMIT 5
  ) q;

  RETURN jsonb_build_object('zones', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.experience_zones_near_point(double precision, double precision, double precision)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.experience_zones_near_point IS
  'Active primary experience zones within radius of a point, excluding zones that cover the point. Includes distance + closest-edge label point + simplified geometry for approach chrome.';
