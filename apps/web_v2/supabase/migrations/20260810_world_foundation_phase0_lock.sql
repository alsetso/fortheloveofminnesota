-- Phase 0 foundation lock for iOS MVP:
-- 1) Reconcile model_categories ↔ element_types vocabulary (rides + block)
-- 2) Enable RLS on model_categories / place_collections / place_collection_models
-- 3) Expose found_header / found_footer on world_list_models (iOS already maps them)
-- 4) Ship bbox filter on world_list_placements (tile streaming path was falling back)

-- ── 1. Vocabulary reconciliation ─────────────────────────────────────────────
INSERT INTO world.element_types (slug, label, color, sort_order)
VALUES ('rides', 'Rides', '#EC4899', 90)
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO world.model_categories (slug, label, description, sort_order, active)
VALUES (
  'block',
  'Block',
  'Buildable cubes — dirt, brick, blank',
  90,
  true
)
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    active = true;

-- ── 2. RLS hardening ─────────────────────────────────────────────────────────
ALTER TABLE world.model_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE world.place_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE world.place_collection_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS model_categories_public_read ON world.model_categories;
CREATE POLICY model_categories_public_read
  ON world.model_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS model_categories_admin_write ON world.model_categories;
CREATE POLICY model_categories_admin_write
  ON world.model_categories
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS place_collections_public_read ON world.place_collections;
CREATE POLICY place_collections_public_read
  ON world.place_collections
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS place_collections_admin_write ON world.place_collections;
CREATE POLICY place_collections_admin_write
  ON world.place_collections
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS place_collection_models_public_read ON world.place_collection_models;
CREATE POLICY place_collection_models_public_read
  ON world.place_collection_models
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS place_collection_models_admin_write ON world.place_collection_models;
CREATE POLICY place_collection_models_admin_write
  ON world.place_collection_models
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

GRANT SELECT ON world.model_categories TO anon, authenticated;
GRANT SELECT ON world.place_collections TO anon, authenticated;
GRANT SELECT ON world.place_collection_models TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON world.model_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON world.place_collections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON world.place_collection_models TO authenticated;

-- ── 3. world_list_models — add found_header / found_footer ────────────────────
DROP FUNCTION IF EXISTS public.world_list_models(boolean);

CREATE FUNCTION public.world_list_models(p_active_only boolean DEFAULT false)
RETURNS TABLE(
  id uuid,
  slug text,
  name text,
  file_path text,
  category text,
  tags text[],
  active boolean,
  sort_order integer,
  real_world_meters numeric,
  native_units_max numeric,
  default_rotation_z numeric,
  default_height_meters numeric,
  allow_user_scale boolean,
  interaction text,
  on_collect text,
  reward jsonb,
  rare boolean,
  found_header text,
  found_footer text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'world'
AS $function$
  SELECT
    m.id,
    m.slug,
    m.name,
    m.file_path,
    m.category,
    coalesce((
      SELECT array_agg(t.slug ORDER BY t.sort_order, t.slug)
      FROM world.world_model_taggings mt
      JOIN world.world_model_tags t ON t.id = mt.tag_id
      WHERE mt.model_id = m.id AND t.active IS TRUE
    ), '{}'::text[]) AS tags,
    m.active,
    m.sort_order,
    m.real_world_meters,
    m.native_units_max,
    m.default_rotation_z,
    m.default_height_meters,
    m.allow_user_scale,
    m.interaction,
    m.on_collect,
    m.reward,
    m.rare,
    m.found_header,
    m.found_footer
  FROM world.world_models m
  WHERE (NOT p_active_only) OR m.active IS TRUE
  ORDER BY m.active DESC, m.sort_order NULLS LAST, m.name;
$function$;

REVOKE ALL ON FUNCTION public.world_list_models(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.world_list_models(boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.world_list_models(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.world_list_models(boolean) TO service_role;

-- ── 4. world_list_placements — bbox filter (preserve uuid[] CTU + collect logic)
DROP FUNCTION IF EXISTS public.world_list_placements(text[], uuid[], uuid);

CREATE FUNCTION public.world_list_placements(
  p_slugs         text[]  DEFAULT NULL,
  p_ctu_unit_ids  uuid[]  DEFAULT NULL,
  p_account_id    uuid    DEFAULT NULL,
  p_bbox_west     numeric DEFAULT NULL,
  p_bbox_south    numeric DEFAULT NULL,
  p_bbox_east     numeric DEFAULT NULL,
  p_bbox_north    numeric DEFAULT NULL
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

REVOKE ALL ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric) TO service_role;

COMMENT ON FUNCTION public.world_list_models(boolean) IS
  'iOS/admin catalog RPC. Guaranteed columns include found_header/found_footer. Additive-only changes after iOS V1.';

COMMENT ON FUNCTION public.world_list_placements(text[], uuid[], uuid, numeric, numeric, numeric, numeric) IS
  'iOS placement stream RPC. bbox params power tile streaming; null bbox preserves CTU/account scoping.';
