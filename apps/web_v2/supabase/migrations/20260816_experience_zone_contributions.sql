-- ============================================================================
-- experience_zone_contributions
--
-- Adds two fields to world.experience_zones:
--   visibility         — public | invite | private  (who can see the zone)
--   allow_contributions — boolean                   (community pins on/off)
--
-- Updates experience_zone_at_point RPC to surface both fields so the iOS
-- client can show "Would you like to contribute to [zone]?" when inside a
-- zone but not exploring, and block the contribute sheet with a friendly
-- message when exploring a zone that has contributions turned off.
-- ============================================================================

ALTER TABLE world.experience_zones
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'invite', 'private'));

ALTER TABLE world.experience_zones
  ADD COLUMN IF NOT EXISTS allow_contributions boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN world.experience_zones.visibility IS
  'Who can see the zone: public (everyone), invite (invited accounts), private (staff only).';

COMMENT ON COLUMN world.experience_zones.allow_contributions IS
  'When false, the contribute sheet is blocked for users exploring this zone. Existing posts are unaffected.';

-- ─── Update at-point RPC ─────────────────────────────────────────────────────

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
  v_rows  jsonb := '[]'::jsonb;
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
        'id',                  z.id,
        'slug',                z.slug,
        'name',                z.name,
        'description',         z.description,
        'visibility',          z.visibility,
        'allow_contributions', z.allow_contributions
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
  'Active experience zones containing the point, smallest area first. Returns visibility and allow_contributions for contribute-sheet gating. No presence/XP side effects.';
