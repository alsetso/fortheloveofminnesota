-- Experience Zones — named polygons for custom map experiences (e.g. State Fairgrounds).
-- Distinct from civic territory.* units (CTU/county/passport). Modes are schema-only in MVP.

-- ─── 1. Tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS world.experience_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  geom geography(Polygon, 4326) NOT NULL,
  geometry_simplified jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active')),
  page_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT experience_zones_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS experience_zones_geom_idx
  ON world.experience_zones USING gist (geom);

CREATE INDEX IF NOT EXISTS experience_zones_status_idx
  ON world.experience_zones (status)
  WHERE status = 'active';

COMMENT ON TABLE world.experience_zones IS
  'Named experience polygons (e.g. Minnesota State Fairgrounds). Not civic territory units.';

CREATE TABLE IF NOT EXISTS world.experience_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES world.experience_zones(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT experience_modes_zone_slug_unique UNIQUE (zone_id, slug)
);

CREATE INDEX IF NOT EXISTS experience_modes_zone_idx
  ON world.experience_modes (zone_id);

COMMENT ON TABLE world.experience_modes IS
  'Temporal/content modes for an experience zone (e.g. Active Fair vs Non-Fair). MVP seeds a default mode only.';

-- Auto-create a default mode when a zone is inserted.
CREATE OR REPLACE FUNCTION world.experience_zones_seed_default_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'world', 'public'
AS $$
BEGIN
  INSERT INTO world.experience_modes (zone_id, slug, label, is_default, sort_order)
  VALUES (NEW.id, 'default', 'Default', true, 0)
  ON CONFLICT (zone_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experience_zones_seed_default_mode ON world.experience_zones;
CREATE TRIGGER experience_zones_seed_default_mode
  AFTER INSERT ON world.experience_zones
  FOR EACH ROW
  EXECUTE FUNCTION world.experience_zones_seed_default_mode();

CREATE OR REPLACE FUNCTION world.experience_zones_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experience_zones_touch_updated_at ON world.experience_zones;
CREATE TRIGGER experience_zones_touch_updated_at
  BEFORE UPDATE ON world.experience_zones
  FOR EACH ROW
  EXECUTE FUNCTION world.experience_zones_touch_updated_at();

-- ─── 2. Grants / RLS ─────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA world TO anon, authenticated, service_role;
GRANT SELECT ON world.experience_zones TO anon, authenticated, service_role;
GRANT SELECT ON world.experience_modes TO anon, authenticated, service_role;
GRANT ALL ON world.experience_zones TO service_role;
GRANT ALL ON world.experience_modes TO service_role;

ALTER TABLE world.experience_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE world.experience_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS experience_zones_select_active ON world.experience_zones;
CREATE POLICY experience_zones_select_active
  ON world.experience_zones
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS experience_modes_select_via_active_zone ON world.experience_modes;
CREATE POLICY experience_modes_select_via_active_zone
  ON world.experience_modes
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM world.experience_zones z
      WHERE z.id = zone_id AND z.status = 'active'
    )
  );

-- service_role bypasses RLS; admin writes go through service client / SECURITY DEFINER RPCs.

-- ─── 3. RPC: point-in-zone ───────────────────────────────────────────────────

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
        'description', z.description
      )
      ORDER BY ST_Area(z.geom) ASC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM world.experience_zones z
  WHERE z.status = 'active'
    AND ST_Covers(z.geom, v_point);

  RETURN jsonb_build_object('zones', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.experience_zone_at_point(double precision, double precision)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.experience_zone_at_point IS
  'Active experience zones containing the point, smallest area first. No presence/XP side effects.';

-- ─── 4. RPC: create zone (admin / service) ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_experience_zone(
  p_name text,
  p_slug text,
  p_description text DEFAULT NULL,
  p_geometry jsonb DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_created_by uuid DEFAULT NULL
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

  v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry::text), 4326)::geography;
  IF ST_NPoints(v_geom::geometry) < 4 THEN
    RAISE EXCEPTION 'polygon must have at least 4 positions (closed ring)';
  END IF;

  INSERT INTO world.experience_zones (
    slug, name, description, geom, geometry_simplified, status, created_by
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
    p_created_by
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'slug', v_row.slug,
    'name', v_row.name,
    'description', v_row.description,
    'status', v_row.status,
    'geometry', ST_AsGeoJSON(v_row.geom::geometry)::jsonb,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_experience_zone(text, text, text, jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_experience_zone(text, text, text, jsonb, text, uuid)
  TO service_role;

-- ─── 5. RPC: list zones with GeoJSON ─────────────────────────────────────────

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
  -- Drafts only when invoked with the service role (admin APIs).
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
  WHERE v_include_draft OR z.status = 'active';

  RETURN jsonb_build_object('zones', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_experience_zones(boolean)
  TO anon, authenticated, service_role;
