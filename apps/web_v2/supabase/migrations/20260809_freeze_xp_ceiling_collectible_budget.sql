-- Freeze the level-99 ceiling on publish and cap collectibles with an
-- explicit budget. Map seeding no longer silently stretches XP thresholds.
--
-- frozen_ceiling = territory_xp_snapshot + collectible_xp_budget (set at publish)
-- xp_ceiling() reads the published freeze (not live placement counts)
-- Over-budget finds still grant XP (overflow past 100%), like streak/bonus.

ALTER TABLE public.game_economy_versions
  ADD COLUMN IF NOT EXISTS collectible_xp_budget integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS territory_xp_snapshot integer,
  ADD COLUMN IF NOT EXISTS frozen_ceiling integer;

COMMENT ON COLUMN public.game_economy_versions.collectible_xp_budget IS
  'Max collectible XP counted toward the level ceiling. Set on draft; locked into frozen_ceiling at publish.';
COMMENT ON COLUMN public.game_economy_versions.territory_xp_snapshot IS
  'Territory XP total (rates × unit counts) captured when this version was published.';
COMMENT ON COLUMN public.game_economy_versions.frozen_ceiling IS
  'Published level-99 XP ceiling. Null on drafts; set atomically by publish_game_economy_version.';

-- Live territory contribution for published (or provided) rates.
CREATE OR REPLACE FUNCTION public.xp_territory_total(p_rates jsonb DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'territory'
AS $function$
DECLARE
  v_rates jsonb := p_rates;
  v_total integer;
BEGIN
  IF v_rates IS NULL THEN
    SELECT territory_xp_by_kind INTO v_rates
    FROM public.game_economy_versions
    WHERE is_published
    LIMIT 1;
  END IF;
  IF v_rates IS NULL THEN
    v_rates := '{}'::jsonb;
  END IF;

  SELECT coalesce(sum(cnt * coalesce((v_rates ->> kind_key)::int, 10)), 0)
    INTO v_total
  FROM (
    VALUES
      ('district', (SELECT count(*) FROM territory.units WHERE kind = 'congressional')),
      ('county', (SELECT count(*) FROM territory.units WHERE kind = 'county')),
      ('ctu', (SELECT count(*) FROM territory.units WHERE kind = 'ctu')),
      ('school_district', (SELECT count(*) FROM territory.units WHERE kind = 'school_district')),
      ('senate_district', (SELECT count(*) FROM territory.units WHERE kind = 'legislative' AND subtype = 'senate')),
      ('house_district', (SELECT count(*) FROM territory.units WHERE kind = 'legislative' AND subtype = 'house')),
      ('zipcode', (SELECT count(*) FROM territory.units WHERE kind = 'zipcode'))
  ) AS t(kind_key, cnt);

  RETURN v_total;
END;
$function$;

-- Live collectible pool (all placements × reward.xp). Not the ceiling.
CREATE OR REPLACE FUNCTION public.xp_collectible_live_total()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'world'
AS $$
  SELECT coalesce(sum(coalesce((wm.reward->>'xp')::int, 1) * pc.n), 0)::integer
  FROM world.world_models wm
  JOIN (
    SELECT model_id, count(*)::int AS n
    FROM world.world_placements
    GROUP BY model_id
  ) pc ON pc.model_id = wm.id
  WHERE wm.interaction = 'collect';
$$;

-- Backfill the currently published row from today's live pools so swapping
-- xp_ceiling() to frozen reads is a no-op for in-flight clients.
DO $$
DECLARE
  v_territory integer;
  v_collectible integer;
BEGIN
  v_territory := public.xp_territory_total(NULL);
  v_collectible := public.xp_collectible_live_total();

  UPDATE public.game_economy_versions
  SET
    collectible_xp_budget = CASE
      WHEN collectible_xp_budget > 0 THEN collectible_xp_budget
      ELSE v_collectible
    END,
    territory_xp_snapshot = coalesce(territory_xp_snapshot, v_territory),
    frozen_ceiling = coalesce(frozen_ceiling, v_territory + CASE
      WHEN collectible_xp_budget > 0 THEN collectible_xp_budget
      ELSE v_collectible
    END)
  WHERE is_published;
END $$;

-- Published freeze wins. Fallback rebuilds from published rates + budget
-- if an old row somehow lacks frozen_ceiling.
CREATE OR REPLACE FUNCTION public.xp_ceiling()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'world', 'territory'
AS $function$
DECLARE
  v_frozen integer;
  v_budget integer;
  v_territory integer;
BEGIN
  SELECT frozen_ceiling, collectible_xp_budget
    INTO v_frozen, v_budget
  FROM public.game_economy_versions
  WHERE is_published
  LIMIT 1;

  IF v_frozen IS NOT NULL AND v_frozen > 0 THEN
    RETURN v_frozen;
  END IF;

  v_territory := public.xp_territory_total(NULL);
  v_budget := coalesce(v_budget, 0);
  IF v_budget <= 0 THEN
    v_budget := public.xp_collectible_live_total();
  END IF;

  RETURN greatest(v_territory + v_budget, 1);
END;
$function$;

COMMENT ON FUNCTION public.xp_ceiling() IS
  'Level-99 XP ceiling from the published economy freeze (territory snapshot + collectible budget).';

CREATE OR REPLACE FUNCTION public.publish_game_economy_version(p_version_id uuid)
RETURNS game_economy_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'territory'
AS $function$
DECLARE
  v_row public.game_economy_versions;
  v_territory integer;
  v_budget integer;
  v_frozen integer;
BEGIN
  SELECT * INTO v_row
  FROM public.game_economy_versions
  WHERE id = p_version_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Version % not found', p_version_id;
  END IF;

  v_territory := public.xp_territory_total(v_row.territory_xp_by_kind);
  v_budget := greatest(coalesce(v_row.collectible_xp_budget, 0), 0);
  IF v_budget <= 0 THEN
    v_budget := public.xp_collectible_live_total();
  END IF;
  v_frozen := greatest(v_territory + v_budget, 1);

  UPDATE public.game_economy_versions
  SET is_published = false
  WHERE is_published
    AND id <> p_version_id;

  UPDATE public.game_economy_versions
  SET
    is_published = true,
    published_at = now(),
    collectible_xp_budget = v_budget,
    territory_xp_snapshot = v_territory,
    frozen_ceiling = v_frozen
  WHERE id = p_version_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

COMMENT ON FUNCTION public.publish_game_economy_version(uuid) IS
  'Publishes a draft and freezes territory_xp_snapshot + collectible_xp_budget into frozen_ceiling.';

-- One-time / on-publish heal: preserve % of old ceiling, honor stored level
-- under the new curve, then recompute (ratchet still applies).
CREATE OR REPLACE FUNCTION public.migrate_account_levels_on_economy_publish(
  p_old_ceiling integer,
  p_new_ceiling integer,
  p_version_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_account record;
  v_old integer := greatest(coalesce(p_old_ceiling, 1), 1);
  v_new integer := greatest(coalesce(p_new_ceiling, 1), 1);
  v_exponent numeric;
  v_pct numeric;
  v_target integer;
  v_floor_xp integer;
  v_grant integer;
  v_count integer := 0;
BEGIN
  SELECT curve_exponent INTO v_exponent
  FROM public.game_economy_versions
  WHERE id = p_version_id;
  v_exponent := coalesce(v_exponent, 1);
  IF v_exponent < 0.01 THEN
    v_exponent := 0.01;
  END IF;

  FOR v_account IN
    SELECT account_id, total_xp, level
    FROM public.account_level_state
  LOOP
    v_pct := least(greatest(v_account.total_xp, 0)::numeric / v_old::numeric, 1);
    v_target := ceil(v_pct * v_new)::integer;

    v_floor_xp := ceil(
      power(((greatest(v_account.level, 1) - 1)::numeric / 98), v_exponent) * v_new
    )::integer;
    v_target := greatest(v_target, v_floor_xp, v_account.total_xp);

    v_grant := v_target - v_account.total_xp;
    IF v_grant > 0 THEN
      INSERT INTO public.account_xp_transactions (
        account_id,
        amount,
        source_type,
        reference_type,
        reference_id,
        idempotency_key,
        claimed_at
      ) VALUES (
        v_account.account_id,
        v_grant,
        'gift',
        'economy_publish_heal',
        p_version_id,
        'economy_publish_heal:' || p_version_id::text || ':' || v_account.account_id::text,
        now()
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    PERFORM public.recompute_account_level(v_account.account_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

COMMENT ON FUNCTION public.migrate_account_levels_on_economy_publish(integer, integer, uuid) IS
  'Percent-preserve + stored-level floor heal when publishing a new economy version.';

DROP FUNCTION IF EXISTS public.game_economy_published();

CREATE FUNCTION public.game_economy_published()
RETURNS TABLE(
  version_id uuid,
  curve_exponent numeric,
  territory_xp_by_kind jsonb,
  source_xp_by_type jsonb,
  collectible_xp_budget integer,
  territory_xp_snapshot integer,
  frozen_ceiling integer,
  ceiling integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'world', 'territory'
AS $function$
  SELECT
    v.id,
    v.curve_exponent,
    v.territory_xp_by_kind,
    v.source_xp_by_type,
    v.collectible_xp_budget,
    v.territory_xp_snapshot,
    v.frozen_ceiling,
    public.xp_ceiling()
  FROM public.game_economy_versions v
  WHERE v.is_published
  LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.xp_territory_total(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.xp_collectible_live_total() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.xp_ceiling() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.publish_game_economy_version(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.migrate_account_levels_on_economy_publish(integer, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.game_economy_published() TO authenticated, service_role, anon;
