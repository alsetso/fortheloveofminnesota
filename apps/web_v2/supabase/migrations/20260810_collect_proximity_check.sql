-- Phase 1 anti-cheat: require a valid GPS fix within 820 m of the placement.
-- 820 m = Object Radar max range (800 m) + 20 m GPS jitter buffer.
-- Two new exception codes surfaced to the iOS client:
--   location_required  — p_lat / p_lng were not provided
--   too_far_away       — provided fix is outside the proximity window
--
-- All other collect behaviour (auth, cap, idempotency, XP, wallet) unchanged.

CREATE OR REPLACE FUNCTION world.collect_placement(
  p_placement_id uuid,
  p_lat double precision DEFAULT NULL::double precision,
  p_lng double precision DEFAULT NULL::double precision,
  p_account_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  placement_id uuid,
  model_slug text,
  reward jsonb,
  wallet_balance integer,
  total_xp integer,
  level integer,
  highest_level_reached integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'world', 'wallet', 'extensions'
AS $function$
declare
  v_user uuid := auth.uid();
  v_account_id uuid;
  v_placement world.world_placements;
  v_model world.world_models;
  v_reward jsonb;
  v_xp integer;
  v_balance integer := null;
  v_level public.account_level_state;
  v_reward_type text;
  v_amount integer;
  v_claims integer;
  v_cap integer;
  -- Max metres a player may be from the placement to collect it.
  -- Matches Object Radar RANGE_MAX_M (800 m) + 20 m GPS jitter buffer.
  v_collect_radius_m constant double precision := 820.0;
  v_player_geog geography;
  v_placement_geog geography;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- ── GPS fix required ─────────────────────────────────────────────────────
  if p_lat is null or p_lng is null
    or not (p_lat between -90 and 90)
    or not (p_lng between -180 and 180)
  then
    raise exception 'location_required' using errcode = 'P0001';
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

  select p.* into v_placement from world.world_placements p where p.id = p_placement_id for update;
  if v_placement.id is null then
    raise exception 'placement_not_found' using errcode = 'P0001';
  end if;
  if v_placement.visible is not true then
    raise exception 'placement_unavailable' using errcode = 'P0001';
  end if;

  -- ── Proximity check ──────────────────────────────────────────────────────
  -- Cast both points to geography for accurate metre-based distance.
  v_player_geog    := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_placement_geog := ST_SetSRID(
    ST_MakePoint(v_placement.lng::double precision, v_placement.lat::double precision),
    4326
  )::geography;

  if ST_Distance(v_player_geog, v_placement_geog) > v_collect_radius_m then
    raise exception 'too_far_away' using errcode = 'P0001';
  end if;

  select m.* into v_model from world.world_models m where m.id = v_placement.model_id;
  if v_model.interaction <> 'collect' then
    raise exception 'not_collectible' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from world.world_collections wc
    where wc.account_id = v_account_id and wc.placement_id = p_placement_id
  ) then
    raise exception 'already_collected' using errcode = 'P0001';
  end if;

  select count(*)::int into v_claims
  from world.world_collections wc
  where wc.placement_id = p_placement_id;

  -- Rare finds: default 1 claimer unless total_available is set. Common finds: unlimited.
  v_cap := case
    when v_model.rare then coalesce(v_placement.total_available, 1)
    else v_placement.total_available
  end;

  if v_cap is not null and v_claims >= v_cap then
    update world.world_placements set visible = false where id = p_placement_id;
    raise exception 'placement_unavailable' using errcode = 'P0001';
  end if;

  v_reward      := v_model.reward;
  v_xp          := coalesce(jsonb_extract_path_text(v_reward, 'xp')::int, 1);
  v_reward_type := jsonb_extract_path_text(v_reward, 'type');
  v_amount      := coalesce(jsonb_extract_path_text(v_reward, 'amount')::int, 1);

  insert into world.world_collections (account_id, placement_id, model_id, reward)
  values (v_account_id, p_placement_id, v_model.id, v_reward);

  if v_reward_type = 'credits' then
    perform wallet.record_transaction(
      p_owner_type => 'account',
      p_owner_id => v_account_id,
      p_purse => 'tool_credits',
      p_amount => v_amount,
      p_type => 'reward',
      p_action => 'collect',
      p_description => v_model.name || ' collected',
      p_reference_type => 'world_collection',
      p_reference_id => p_placement_id,
      p_idempotency_key => 'collect:tool_credits:' || v_account_id::text || ':' || p_placement_id::text
    );
    v_balance := wallet.balance('account', v_account_id, 'tool_credits');
  end if;

  -- Cap reached → hide for everyone. Common collectibles stay visible; list RPC
  -- hides per-account when on_collect = 'remove'.
  if v_cap is not null and (v_claims + 1) >= v_cap then
    update world.world_placements set visible = false where id = p_placement_id;
  end if;

  insert into public.account_xp_transactions (account_id, amount, source_type, reference_type, reference_id, idempotency_key, claimed_at)
  values (
    v_account_id,
    v_xp,
    'collect',
    'world_collection',
    p_placement_id,
    'xp:collect:' || v_account_id::text || ':' || p_placement_id::text,
    now()
  )
  on conflict (idempotency_key) do nothing;

  select * into v_level from public.recompute_account_level(v_account_id);

  return query select
    v_placement.id,
    v_model.slug,
    v_reward,
    v_balance,
    v_level.total_xp,
    v_level.level,
    v_level.highest_level_reached;
end;
$function$;

COMMENT ON FUNCTION world.collect_placement(uuid, double precision, double precision, uuid) IS
  'Atomic collect: auth + proximity (820 m) + cap + idempotency + wallet/XP grant. '
  'Raises location_required when no GPS fix is provided; too_far_away when fix is outside radius.';
