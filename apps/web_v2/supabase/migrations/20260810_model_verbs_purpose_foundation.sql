-- Model verbs + purpose foundation (additive).
-- interaction column becomes the tap verb vocabulary (keeps legacy 'none').
-- purpose = why the model exists (branch map). tap_payload = future CTA/json.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE world.world_models
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'presence';

ALTER TABLE world.world_models
  ADD COLUMN IF NOT EXISTS tap_payload jsonb;

COMMENT ON COLUMN world.world_models.purpose IS
  'North-star branch: presence | utility | collectible | progress | story | social | redeem';

COMMENT ON COLUMN world.world_models.interaction IS
  'Tap verb: none|see|info|collect|route|check_in|unlock|redeem|challenge. Legacy none = see.';

COMMENT ON COLUMN world.world_models.tap_payload IS
  'Optional verb payload (links, CTAs, unlock sku, redeem code meta). Shape per verb.';

-- Drop prior narrow checks if present (name may vary).
ALTER TABLE world.world_models DROP CONSTRAINT IF EXISTS world_models_interaction_check;
ALTER TABLE world.world_models DROP CONSTRAINT IF EXISTS world_models_interaction_verb_check;
ALTER TABLE world.world_models DROP CONSTRAINT IF EXISTS world_models_purpose_check;

ALTER TABLE world.world_models
  ADD CONSTRAINT world_models_purpose_check
  CHECK (purpose IN (
    'presence', 'utility', 'collectible', 'progress', 'story', 'social', 'redeem'
  ));

ALTER TABLE world.world_models
  ADD CONSTRAINT world_models_interaction_verb_check
  CHECK (interaction IN (
    'none', 'see', 'info', 'collect', 'route',
    'check_in', 'unlock', 'redeem', 'challenge'
  ));

-- ── 2. Seed purpose from existing data (best-effort) ─────────────────────────
UPDATE world.world_models
SET purpose = 'collectible'
WHERE interaction = 'collect'
  AND purpose = 'presence';

UPDATE world.world_models
SET purpose = 'utility'
WHERE category = 'sign'
  AND interaction IN ('none', 'see', 'info')
  AND purpose = 'presence';

-- ── 3. world_list_models — expose purpose + tap_payload ───────────────────────
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
  found_footer text,
  purpose text,
  tap_payload jsonb
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
    m.found_footer,
    m.purpose,
    m.tap_payload
  FROM world.world_models m
  WHERE (NOT p_active_only) OR m.active IS TRUE
  ORDER BY m.active DESC, m.sort_order NULLS LAST, m.name;
$function$;

REVOKE ALL ON FUNCTION public.world_list_models(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.world_list_models(boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.world_list_models(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.world_list_models(boolean) TO service_role;

COMMENT ON FUNCTION public.world_list_models(boolean) IS
  'iOS/admin catalog RPC. Includes purpose + tap_payload for verb foundation. Additive-only after iOS V1.';
