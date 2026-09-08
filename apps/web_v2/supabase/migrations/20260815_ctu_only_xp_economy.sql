-- Cities & Towns first: CTU earns 70 XP on unlock; all other territory kinds earn 0.
--
-- Design intent:
--   · We track all 7 territory kinds in account_territory_presence (data completeness).
--   · Only CTU (ctu) is surfaced in product UI, passport bars, and unlock ceremonies.
--   · Writing a 0-XP transaction for non-CTU presence would pollute the claim ledger,
--     so the presence RPC now skips the XP insert when the resolved amount is 0.
--   · A new published economy version is created and published atomically; the previous
--     version is unpublished.  Existing unclaimed territory_unlock transactions keep
--     their original amounts (the ledger is append-only).

-- ─── 1. territory_unlock_xp: read the published rate for a given kind ────────────────
--
-- Used by report_territory_presence to resolve the per-kind XP amount at presence time.
-- Returns the rate from the published economy version, or 0 if no version is published.

CREATE OR REPLACE FUNCTION public.territory_unlock_xp(p_kind text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rates jsonb;
  v_amount integer;
BEGIN
  SELECT territory_xp_by_kind
    INTO v_rates
  FROM public.game_economy_versions
  WHERE is_published
  LIMIT 1;

  IF v_rates IS NULL THEN
    RETURN 0;
  END IF;

  v_amount := (v_rates ->> p_kind)::integer;
  RETURN coalesce(v_amount, 0);
END;
$function$;

COMMENT ON FUNCTION public.territory_unlock_xp(text) IS
  'Published XP rate for a territory kind. Returns 0 when no published economy exists or kind is unlisted.';

GRANT EXECUTE ON FUNCTION public.territory_unlock_xp(text) TO authenticated, service_role;

-- ─── 2. report_territory_presence: skip 0-XP transactions ────────────────────────────
--
-- Non-CTU presences (county, school_district, etc.) will now resolve to 0 XP.
-- Writing a 0-amount transaction would create claim-flow noise without game value,
-- so we guard the insert with v_xp > 0.  The presence row itself is still written
-- for every tracked kind — the passport data layer is unaffected.

CREATE OR REPLACE FUNCTION public.report_territory_presence(
  p_lat double precision,
  p_lng double precision,
  p_account_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  out_unit_kind text,
  out_unit_id uuid,
  out_name text,
  out_newly_unlocked boolean,
  out_xp_amount integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'world', 'territory', 'extensions'
AS $function$
declare
  v_user uuid := auth.uid();
  v_account_id uuid;
  v_result jsonb;
  v_item jsonb;
  v_kind text;
  v_unit_id uuid;
  v_name text;
  v_new boolean;
  v_xp integer;
  v_last record;
  v_seconds double precision;
  v_meters double precision;
  -- 70 m/s ≈ 252 km/h. Above highway speeds; rejects teleport spoofs.
  v_max_speed_mps constant double precision := 70.0;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_lat is null or p_lng is null
    or not (p_lat between -90 and 90)
    or not (p_lng between -180 and 180)
  then
    raise exception 'Invalid lat/lng' using errcode = 'P0001';
  end if;

  if p_account_id is not null then
    if not public.user_owns_account(p_account_id) then
      raise exception 'Account does not belong to caller' using errcode = 'P0001';
    end if;
    v_account_id := p_account_id;
  else
    select id into v_account_id from public.accounts where user_id = v_user limit 1;
  end if;

  if v_account_id is null then
    raise exception 'No account for user';
  end if;

  -- Velocity gate against last accepted presence fix.
  select lat, lng, recorded_at into v_last
  from public.account_last_fix
  where account_id = v_account_id;

  if v_last.recorded_at is not null then
    v_seconds := greatest(extract(epoch from (now() - v_last.recorded_at)), 0.001);
    v_meters := st_distance(
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      st_setsrid(st_makepoint(v_last.lng, v_last.lat), 4326)::geography
    );
    if (v_meters / v_seconds) > v_max_speed_mps then
      -- Do NOT update account_last_fix — keep the last plausible fix anchored.
      raise exception 'location_implausible' using errcode = 'P0001';
    end if;
  end if;

  insert into public.account_last_fix (account_id, lat, lng, recorded_at)
  values (v_account_id, p_lat, p_lng, now())
  on conflict (account_id) do update
    set lat = excluded.lat,
        lng = excluded.lng,
        recorded_at = excluded.recorded_at;

  select public.territory_at_point(p_lat, p_lng) into v_result;

  for v_item in select * from jsonb_array_elements(coalesce(v_result->'jurisdictions', '[]'::jsonb))
  loop
    v_kind := v_item->>'kind';
    if v_kind not in (
      'county', 'ctu', 'school_district', 'district',
      'senate_district', 'house_district', 'zipcode'
    ) then
      continue;
    end if;
    v_unit_id := (v_item->>'id')::uuid;
    v_name := v_item->>'name';
    v_xp := public.territory_unlock_xp(v_kind);

    insert into public.account_territory_presence (
      account_id, unit_kind, unit_id, first_seen_at, last_seen_at, visit_count
    )
    values (v_account_id, v_kind, v_unit_id, now(), now(), 1)
    on conflict (account_id, unit_kind, unit_id) do update
      set last_seen_at = now(),
          visit_count = public.account_territory_presence.visit_count + 1
    returning (xmax = 0) into v_new;

    -- Only write an XP transaction when there is actual XP to award.
    -- Non-CTU kinds resolve to 0 XP in the current economy; writing a
    -- 0-amount row would create claim-flow noise without game value.
    if v_new and v_xp > 0 then
      insert into public.account_xp_transactions (
        account_id, amount, source_type, reference_type, reference_id, idempotency_key
      )
      values (
        v_account_id,
        v_xp,
        'territory_unlock',
        v_kind,
        v_unit_id,
        'xp:unlock:' || v_account_id::text || ':' || v_kind || ':' || v_unit_id::text
      )
      on conflict (idempotency_key) do nothing;
    end if;

    return query select v_kind, v_unit_id, v_name, v_new, v_xp;
  end loop;
  -- Level intentionally NOT recomputed — unlock XP stays pending until claim.
end;
$function$;

COMMENT ON FUNCTION public.report_territory_presence(double precision, double precision, uuid) IS
  'Upserts passport presence for all 7 territory kinds. '
  'XP transactions are only written when the resolved amount > 0 (currently: CTU only, 70 XP). '
  'Rejects with location_implausible when implied speed from account_last_fix exceeds 70 m/s (~252 km/h).';

-- ─── 3. New published economy: CTU = 70 XP, all other kinds = 0 ─────────────────────

DO $$
DECLARE
  v_old_id uuid;
  v_old_ceiling integer;
  v_new_id uuid;
  v_source_xp jsonb;
  v_collectible integer;
  v_curve numeric;
BEGIN
  -- Snapshot the currently published version so we can carry forward
  -- engagement rates, collectible budget, and level-migration data.
  SELECT
    id,
    frozen_ceiling,
    coalesce(source_xp_by_type, '{"daily_streak": 250}'::jsonb),
    coalesce(collectible_xp_budget, 0),
    coalesce(curve_exponent, 1)
  INTO v_old_id, v_old_ceiling, v_source_xp, v_collectible, v_curve
  FROM public.game_economy_versions
  WHERE is_published
  LIMIT 1;

  -- Insert the new draft with CTU-only XP rates.
  INSERT INTO public.game_economy_versions (
    is_published,
    curve_exponent,
    territory_xp_by_kind,
    source_xp_by_type,
    collectible_xp_budget,
    notes,
    created_by
  ) VALUES (
    false,
    coalesce(v_curve, 1),
    '{
      "district":       0,
      "county":         0,
      "ctu":            70,
      "school_district": 0,
      "senate_district": 0,
      "house_district":  0,
      "zipcode":         0
    }'::jsonb,
    v_source_xp,
    coalesce(v_collectible, 0),
    'Cities & towns focus: CTU 70 XP, all other territory kinds 0 XP. '
    'Presence tracking unchanged across all 7 kinds.',
    null
  )
  RETURNING id INTO v_new_id;

  -- Publish atomically — publish_game_economy_version unpublishes the old row,
  -- recomputes territory_xp_snapshot from live unit counts × new rates, and
  -- freezes the new ceiling.
  PERFORM public.publish_game_economy_version(v_new_id);
END $$;
