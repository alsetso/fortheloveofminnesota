-- Experience zone nesting — explicit parent_zone_id for sub-zones drawn inside a work zone.
-- Geometric ST_Covers + smallest-area primary still drives membership; parent is authorship + badge copy.

-- ─── 1. Column ───────────────────────────────────────────────────────────────

ALTER TABLE world.experience_zones
  ADD COLUMN IF NOT EXISTS parent_zone_id uuid
    REFERENCES world.experience_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS experience_zones_parent_idx
  ON world.experience_zones (parent_zone_id)
  WHERE parent_zone_id IS NOT NULL;

COMMENT ON COLUMN world.experience_zones.parent_zone_id IS
  'Optional parent experience zone (sub-zone drawn inside a work-mode district).';

-- Prevent a zone from parenting itself.
ALTER TABLE world.experience_zones
  DROP CONSTRAINT IF EXISTS experience_zones_parent_not_self;
ALTER TABLE world.experience_zones
  ADD CONSTRAINT experience_zones_parent_not_self
  CHECK (parent_zone_id IS NULL OR parent_zone_id <> id);

-- ─── 2. RPC: point-in-zone (include parent for badge) ────────────────────────

CREATE OR REPLACE FUNCTION public.experience_zone_at_point(
  p_lat double precision,
  p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'world', 'extensions'
AS $$
DECLARE
  v_point geography;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('zones', '[]'::jsonb);
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', z.id,
        'slug', z.slug,
        'name', z.name,
        'description', z.description,
        'parent_zone_id', z.parent_zone_id,
        'parent_name', p.name
      )
      ORDER BY ST_Area(z.geom) ASC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM world.experience_zones z
  LEFT JOIN world.experience_zones p ON p.id = z.parent_zone_id
  WHERE z.status = 'active'
    AND ST_Covers(z.geom, v_point);

  RETURN jsonb_build_object('zones', v_rows);
END;
$$;

COMMENT ON FUNCTION public.experience_zone_at_point IS
  'Active experience zones containing the point, smallest area first. Includes parent_zone_id/parent_name for nested badge copy.';

-- ─── 3. RPC: create zone (accept parent) ─────────────────────────────────────

DROP FUNCTION IF EXISTS public.create_experience_zone(text, text, text, jsonb, text, uuid);

CREATE OR REPLACE FUNCTION public.create_experience_zone(
  p_name text,
  p_slug text,
  p_description text DEFAULT NULL,
  p_geometry jsonb DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_created_by uuid DEFAULT NULL,
  p_parent_zone_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'world', 'extensions'
AS $$
DECLARE
  v_geom geography;
  v_row world.experience_zones%ROWTYPE;
  v_status text;
  v_parent world.experience_zones%ROWTYPE;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'name is required';
  END IF;
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'slug is required';
  END IF;
  IF p_geometry IS NULL OR p_geometry->>'type' IS DISTINCT FROM 'Polygon' THEN
    RAISE EXCEPTION 'geometry must be a GeoJSON Polygon';
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_status), ''), 'active');
  IF v_status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  IF p_parent_zone_id IS NOT NULL THEN
    SELECT * INTO v_parent
    FROM world.experience_zones
    WHERE id = p_parent_zone_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'parent zone not found';
    END IF;
  END IF;

  v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry::text), 4326)::geography;
  IF ST_NPoints(v_geom::geometry) < 4 THEN
    RAISE EXCEPTION 'polygon must have at least 4 positions (closed ring)';
  END IF;

  INSERT INTO world.experience_zones (
    slug, name, description, geom, geometry_simplified, status, created_by, parent_zone_id
  )
  VALUES (
    btrim(p_slug),
    btrim(p_name),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    v_geom,
    COALESCE(
      ST_AsGeoJSON(ST_SimplifyPreserveTopology(v_geom::geometry, 0.00005))::jsonb,
      ST_AsGeoJSON(v_geom::geometry)::jsonb
    ),
    v_status,
    p_created_by,
    p_parent_zone_id
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'slug', v_row.slug,
    'name', v_row.name,
    'description', v_row.description,
    'status', v_row.status,
    'parent_zone_id', v_row.parent_zone_id,
    'parent_name', v_parent.name,
    'geometry', ST_AsGeoJSON(v_row.geom::geometry)::jsonb,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_experience_zone(text, text, text, jsonb, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_experience_zone(text, text, text, jsonb, text, uuid, uuid)
  TO service_role;

-- ─── 4. RPC: list zones (include parent) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_experience_zones(
  p_include_draft boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'world', 'extensions'
AS $$
DECLARE
  v_rows jsonb;
  v_include_draft boolean;
BEGIN
  v_include_draft := COALESCE(p_include_draft, false)
    AND COALESCE(auth.role(), '') = 'service_role';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', z.id,
        'slug', z.slug,
        'name', z.name,
        'description', z.description,
        'status', z.status,
        'parent_zone_id', z.parent_zone_id,
        'parent_name', p.name,
        'geometry', ST_AsGeoJSON(z.geom::geometry)::jsonb,
        'created_at', z.created_at,
        'updated_at', z.updated_at
      )
      ORDER BY z.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM world.experience_zones z
  LEFT JOIN world.experience_zones p ON p.id = z.parent_zone_id
  WHERE v_include_draft OR z.status = 'active';

  RETURN jsonb_build_object('zones', v_rows);
END;
$$;
