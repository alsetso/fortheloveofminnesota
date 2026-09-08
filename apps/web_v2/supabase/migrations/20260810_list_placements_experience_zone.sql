-- Zone-scoped placement stream: optional p_experience_zone_id filter via
-- world.world_placement_experience_zones (State Fair / venue mode).

DROP FUNCTION IF EXISTS public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric);

CREATE FUNCTION public.world_list_placements(
  p_slugs              text[]  DEFAULT NULL,
  p_ctu_unit_ids       uuid[]  DEFAULT NULL,
  p_account_id         uuid    DEFAULT NULL,
  p_bbox_west          numeric DEFAULT NULL,
  p_bbox_south         numeric DEFAULT NULL,
  p_bbox_east          numeric DEFAULT NULL,
  p_bbox_north         numeric DEFAULT NULL,
  p_experience_zone_id uuid    DEFAULT NULL
)
RETURNS TABLE(
  id               uuid,
  model_id         uuid,
  lat              numeric,
  lng              numeric,
  slug             text,
  scale_multiplier numeric,
  rotation_z       numeric,
  altitude_meters  numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'world'
AS $function$
  SELECT
    p.id,
    p.model_id,
    p.lat,
    p.lng,
    m.slug,
    p.scale_multiplier,
    p.rotation_z,
    p.altitude_meters
  FROM world.world_placements p
  JOIN world.world_models m ON m.id = p.model_id
  WHERE p.visible IS TRUE
    AND m.active IS TRUE
    AND (p_slugs IS NULL OR m.slug = ANY (p_slugs))
    AND (
      p_ctu_unit_ids IS NULL
      OR EXISTS (
        SELECT 1
        FROM world.world_placement_territories t
        WHERE t.placement_id = p.id
          AND t.unit_kind = 'ctu'
          AND t.unit_id = ANY (p_ctu_unit_ids)
      )
    )
    AND (
      p_bbox_west IS NULL
      OR (
        p.lng >= p_bbox_west
        AND p.lat >= p_bbox_south
        AND p.lng <= p_bbox_east
        AND p.lat <= p_bbox_north
      )
    )
    AND (
      p_experience_zone_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM world.world_placement_experience_zones ez
        WHERE ez.placement_id = p.id
          AND ez.zone_id = p_experience_zone_id
      )
    )
    AND NOT (
      m.on_collect = 'remove'
      AND (
        (
          p_account_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM world.world_collections wc
            WHERE wc.placement_id = p.id
              AND wc.account_id = p_account_id
          )
        )
        OR (
          p_account_id IS NULL
          AND auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM world.world_collections wc
            JOIN public.accounts a ON a.id = wc.account_id
            WHERE wc.placement_id = p.id
              AND a.user_id = auth.uid()
          )
        )
      )
    )
    AND NOT (
      coalesce(
        CASE WHEN m.rare THEN coalesce(p.total_available, 1) ELSE p.total_available END,
        0
      ) > 0
      AND (
        SELECT count(*)::int
        FROM world.world_collections wc
        WHERE wc.placement_id = p.id
      ) >= coalesce(
        CASE WHEN m.rare THEN coalesce(p.total_available, 1) ELSE p.total_available END,
        2147483647
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric, uuid) TO service_role;

COMMENT ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric, uuid) IS
  'iOS placement stream RPC. bbox = tiles; p_experience_zone_id scopes venue mode (e.g. State Fair).';
