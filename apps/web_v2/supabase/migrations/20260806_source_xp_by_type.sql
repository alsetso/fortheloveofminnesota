-- Versioned XP rates for engagement / bonus sources (daily streak, future
-- bonus & gift). Mirrors territory_xp_by_kind on game_economy_versions so
-- draft → preview → publish stays the single economy control path.
--
-- These rates do NOT inflate xp_ceiling() — ceiling is the published
-- frozen_ceiling (territory snapshot + collectible budget). Engagement /
-- bonus XP is overflow on top of that curve.

ALTER TABLE public.game_economy_versions
  ADD COLUMN IF NOT EXISTS source_xp_by_type jsonb NOT NULL
  DEFAULT '{"daily_streak": 250}'::jsonb;

UPDATE public.game_economy_versions
SET source_xp_by_type = COALESCE(source_xp_by_type, '{}'::jsonb)
  || '{"daily_streak": 250}'::jsonb
WHERE source_xp_by_type->>'daily_streak' IS NULL;

COMMENT ON COLUMN public.game_economy_versions.source_xp_by_type IS
  'Repeatable XP rates by source_type (daily_streak, bonus, gift, …). Not part of xp_ceiling.';

-- Future one-off / engagement sources share the ledger CHECK.
ALTER TABLE public.account_xp_transactions
  DROP CONSTRAINT IF EXISTS account_xp_transactions_source_type_check;

ALTER TABLE public.account_xp_transactions
  ADD CONSTRAINT account_xp_transactions_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'collect'::text,
    'territory_unlock'::text,
    'daily_streak'::text,
    'bonus'::text,
    'gift'::text
  ]));

CREATE OR REPLACE FUNCTION public.source_xp(p_source_type text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rates jsonb;
  v_amount integer;
  v_default integer;
BEGIN
  SELECT source_xp_by_type INTO v_rates
  FROM public.game_economy_versions
  WHERE is_published
  LIMIT 1;

  IF v_rates IS NULL THEN
    v_rates := '{}'::jsonb;
  END IF;

  v_default := CASE p_source_type
    WHEN 'daily_streak' THEN 250
    ELSE 0
  END;

  v_amount := COALESCE((v_rates ->> p_source_type)::int, v_default);
  IF v_amount IS NULL OR v_amount < 0 THEN
    v_amount := v_default;
  END IF;

  RETURN v_amount;
END;
$function$;

COMMENT ON FUNCTION public.source_xp(text) IS
  'Published rate for an engagement/bonus source_type from game_economy_versions.source_xp_by_type.';

CREATE OR REPLACE FUNCTION public.daily_streak_xp()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.source_xp('daily_streak');
$$;

DROP FUNCTION IF EXISTS public.game_economy_published();

CREATE FUNCTION public.game_economy_published()
RETURNS TABLE(
  version_id uuid,
  curve_exponent numeric,
  territory_xp_by_kind jsonb,
  source_xp_by_type jsonb,
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
    public.xp_ceiling()
  FROM public.game_economy_versions v
  WHERE v.is_published
  LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.source_xp(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.daily_streak_xp() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.game_economy_published() TO authenticated, service_role, anon;
