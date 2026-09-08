-- Tag placements with the experience zones that contain them (location membership).
-- Mirrors world.world_placement_territories: any model (custom or generic) gets tagged.

CREATE TABLE IF NOT EXISTS world.world_placement_experience_zones (
  placement_id uuid NOT NULL REFERENCES world.world_placements(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES world.experience_zones(id) ON DELETE CASCADE,
  PRIMARY KEY (placement_id, zone_id)
);

CREATE INDEX IF NOT EXISTS world_placement_experience_zones_zone_idx
  ON world.world_placement_experience_zones (zone_id);

COMMENT ON TABLE world.world_placement_experience_zones IS
  'Placement → experience zone membership from lat/lng (point-in-polygon). Not catalog ownership.';

GRANT SELECT ON world.world_placement_experience_zones TO anon, authenticated, service_role;
GRANT ALL ON world.world_placement_experience_zones TO service_role;

ALTER TABLE world.world_placement_experience_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wpez_select_all ON world.world_placement_experience_zones;
CREATE POLICY wpez_select_all
  ON world.world_placement_experience_zones
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Replace zone tags for a placement at a point.
CREATE OR REPLACE FUNCTION public.tag_placement_experience_zones(
  p_placement_id uuid,
  p_lat double precision,
  p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'world', 'extensions'
AS $$
DECLARE
  v_point geography;
  v_zones jsonb := '[]'::jsonb;
BEGIN
  IF p_placement_id IS NULL THEN
    RETURN jsonb_build_object('zones', '[]'::jsonb);
  END IF;

  DELETE FROM world.world_placement_experience_zones
  WHERE placement_id = p_placement_id;

  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('zones', '[]'::jsonb);
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  INSERT INTO world.world_placement_experience_zones (placement_id, zone_id)
  SELECT p_placement_id, z.id
  FROM world.experience_zones z
  WHERE z.status = 'active'
    AND ST_Covers(z.geom, v_point);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', z.id,
        'slug', z.slug,
        'name', z.name
      )
      ORDER BY ST_Area(z.geom) ASC
    ),
    '[]'::jsonb
  )
  INTO v_zones
  FROM world.world_placement_experience_zones t
  JOIN world.experience_zones z ON z.id = t.zone_id
  WHERE t.placement_id = p_placement_id;

  RETURN jsonb_build_object('zones', v_zones);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tag_placement_experience_zones(uuid, double precision, double precision)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.tag_placement_experience_zones IS
  'Delete+insert experience-zone tags for a placement from lat/lng. Returns tagged zones.';

-- Tag on iOS place RPC as well.
CREATE OR REPLACE FUNCTION public.world_place_model(
  p_slug text,
  p_lng double precision,
  p_lat double precision,
  p_account_id uuid default null,
  p_placed_by_name text default '',
  p_scale_multiplier numeric default 1,
  p_rotation_z numeric default 0
)
RETURNS table (
  id uuid,
  model_id uuid,
  lat numeric,
  lng numeric,
  slug text,
  file_path text,
  scale_multiplier numeric,
  rotation_z numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'world', 'extensions'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_model uuid;
  v_placement_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.id INTO v_model
  FROM world.world_models m
  WHERE m.slug = p_slug AND m.active IS TRUE
  LIMIT 1;

  IF v_model IS NULL THEN
    RAISE EXCEPTION 'Unknown or inactive model slug: %', p_slug;
  END IF;

  INSERT INTO world.world_placements (
    model_id,
    placed_by_user_id,
    placed_by_account_id,
    placed_by_name,
    location,
    scale_multiplier,
    rotation_z
  ) VALUES (
    v_model,
    v_user,
    p_account_id,
    coalesce(p_placed_by_name, ''),
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    coalesce(p_scale_multiplier, 1),
    coalesce(p_rotation_z, 0)
  )
  RETURNING world.world_placements.id INTO v_placement_id;

  -- Civic territories (existing pattern in admin APIs; keep RPC parity light)
  -- Experience zones — always tag when inside an active zone.
  PERFORM public.tag_placement_experience_zones(v_placement_id, p_lat, p_lng);

  RETURN QUERY
  SELECT
    p.id,
    p.model_id,
    p.lat,
    p.lng,
    m.slug,
    m.file_path,
    p.scale_multiplier,
    p.rotation_z
  FROM world.world_placements p
  JOIN world.world_models m ON m.id = p.model_id
  WHERE p.id = v_placement_id;
END;
$$;

-- Backfill existing placements that already sit inside active zones.
INSERT INTO world.world_placement_experience_zones (placement_id, zone_id)
SELECT p.id, z.id
FROM world.world_placements p
JOIN world.experience_zones z
  ON z.status = 'active'
 AND ST_Covers(z.geom, p.location)
ON CONFLICT DO NOTHING;
