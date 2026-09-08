-- Phase 2 anti-cheat: harden report_territory_presence velocity gate.
--
-- Prior behaviour: silent early RETURN when speed > 67 m/s (~241 km/h).
-- New behaviour: RAISE location_implausible (client maps to 400; sync treats
-- as soft no-op so legit GPS glitches don't spam UI).
--
-- Threshold: 70 m/s ≈ 252 km/h — above highway/plane-ascent rates but well
-- below teleport spoofing. account_last_fix is NOT updated on reject, so a
-- subsequent plausible fix from the last known point still succeeds.
--
-- Table public.account_last_fix already exists (account_id PK, lat, lng,
-- recorded_at) — no schema change required.

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

    if v_new then
      -- Held unclaimed — claim flow must confirm before XP counts toward level.
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
  'Upserts passport presence + pending unlock XP at a GPS fix. '
  'Rejects with location_implausible when implied speed from account_last_fix exceeds 70 m/s (~252 km/h).';
