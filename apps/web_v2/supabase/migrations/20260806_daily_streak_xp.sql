-- Daily login streak XP — grant once per America/Chicago calendar day on
-- world-session activity. Unclaimed until claim_account_xp (same path as
-- territory unlocks). Calendar "active" days still come from
-- account_world_sessions; this only adds the reward layer.

ALTER TABLE public.account_xp_transactions
  DROP CONSTRAINT IF EXISTS account_xp_transactions_source_type_check;

ALTER TABLE public.account_xp_transactions
  ADD CONSTRAINT account_xp_transactions_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'collect'::text,
    'territory_unlock'::text,
    'daily_streak'::text
  ]));

CREATE OR REPLACE FUNCTION public.daily_streak_xp()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT 250;
$$;

COMMENT ON FUNCTION public.daily_streak_xp() IS
  'Flat XP awarded once per calendar day when the account maintains a login streak.';

CREATE OR REPLACE FUNCTION public.grant_daily_streak_xp(p_account_id uuid)
RETURNS TABLE(
  out_granted boolean,
  out_amount integer,
  out_streak_day date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_day date;
  v_amount integer;
  v_key text;
  v_row_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_owns_account(p_account_id) THEN
    RAISE EXCEPTION 'Account does not belong to caller' USING errcode = 'P0001';
  END IF;

  v_day := (timezone('America/Chicago', now()))::date;
  v_amount := public.daily_streak_xp();
  v_key := 'xp:daily_streak:' || p_account_id::text || ':' || v_day::text;

  -- Held unclaimed — user confirms via claim flow before it counts toward level.
  INSERT INTO public.account_xp_transactions (
    account_id,
    amount,
    source_type,
    reference_type,
    reference_id,
    idempotency_key
  )
  VALUES (
    p_account_id,
    v_amount,
    'daily_streak',
    'calendar_day',
    NULL,
    v_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_row_id;

  RETURN QUERY SELECT
    (v_row_id IS NOT NULL),
    v_amount,
    v_day;
END;
$function$;

COMMENT ON FUNCTION public.grant_daily_streak_xp(uuid) IS
  'Idempotent daily streak XP grant for one America/Chicago calendar day.';

GRANT EXECUTE ON FUNCTION public.daily_streak_xp() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_daily_streak_xp(uuid) TO authenticated, service_role;
