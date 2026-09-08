-- ============================================================================
-- World interaction expansion — complete verb architecture
-- ============================================================================
--
-- Goals:
--   1. Data integrity: migrate legacy interaction='none' → 'see' on all models.
--   2. world_collections.kind — discriminates collect vs find vs check_in.
--   3. collect_placement RPC — accepts p_kind, writes kind to world_collections;
--      claimable verbs expanded to include 'check_in'.
--
-- No CHECK changes needed — the full verb set was already added in
-- 20260810_model_verbs_purpose_foundation.sql.
-- ============================================================================

-- ── 1. Data: normalize legacy interaction='none' → 'see' ──────────────────
-- The 'none' alias was the initial default. All clients already normalise it
-- via resolveModelVerb(), but keeping it in the DB confuses Admin filters.
UPDATE world.world_models
SET    interaction = 'see'
WHERE  interaction = 'none';

-- Update the purpose seeding that ran in 20260810 — 'none' rows that were
-- seeded as presence/utility are fine; already correct.

-- ── 2. world_collections.kind ─────────────────────────────────────────────
-- Distinguishes the claim type so queries like "what landmarks have I found"
-- can filter without joining back to world_models.
ALTER TABLE world.world_collections
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'collect';

-- Validate existing rows before adding the constraint.
UPDATE world.world_collections SET kind = 'collect' WHERE kind NOT IN ('collect', 'find', 'check_in', 'redeem');

ALTER TABLE world.world_collections
  DROP CONSTRAINT IF EXISTS world_collections_kind_check;

ALTER TABLE world.world_collections
  ADD CONSTRAINT world_collections_kind_check
  CHECK (kind IN ('collect', 'find', 'check_in', 'redeem'));

COMMENT ON COLUMN world.world_collections.kind IS
  'Claim type: collect (consumable), find (landmark discovery), check_in (visit stamp), redeem.';

-- ── 3. collect_placement RPC — accept p_kind, expand claimable verbs ──────
--
-- Previous signature: (uuid, double, double, uuid)
-- New signature:      (uuid, double, double, uuid, text)
--   p_kind   defaults to 'collect' for backward compatibility.
--
-- Claimable verbs: collect | check_in
--   'collect'  — standard gamified claim (hearts, coins, landmarks with on_collect=stay)
--   'check_in' — visit stamp (proximity enforced, XP granted, no wallet payout)
--
-- Client sends the verb it resolved from the model's interaction field.
-- Server writes it to world_collections.kind for queryability.

DROP FUNCTION IF EXISTS world.collect_placement(uuid, double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION world.collect_placement(
  p_placement_id uuid,
  p_lat          double precision DEFAULT NULL::double precision,
  p_lng          double precision DEFAULT NULL::double precision,
  p_account_id   uuid             DEFAULT NULL::uuid,
  p_kind         text             DEFAULT 'collect'
)
RETURNS TABLE(
  placement_id         uuid,
  model_slug           text,
  reward               jsonb,
  wallet_balance       integer,
  total_xp             integer,
  level                integer,
  highest_level_reached integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'world', 'wallet', 'extensions'
AS $function$
declare
  v_user         uuid := auth.uid();
  v_account_id   uuid;
  v_placement    world.world_placements;
  v_model        world.world_models;
  v_reward       jsonb;
  v_xp           integer;
  v_balance      integer := null;
  v_level        public.account_level_state;
  v_reward_type  text;
  v_amount       integer;
  v_claims       integer;
  v_cap          integer;
  v_kind         text;
  -- Max metres a player may be from the placement to claim it.
  v_collect_radius_m constant double precision := 820.0;
  v_player_geog    geography;
  v_placement_geog geography;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- ── Normalise kind ────────────────────────────────────────────────────────
  v_kind := coalesce(p_kind, 'collect');
  if v_kind not in ('collect', 'find', 'check_in', 'redeem') then
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;

  -- ── GPS fix required ──────────────────────────────────────────────────────
  if p_lat is null or p_lng is null
    or not (p_lat between -90  and  90)
    or not (p_lng between -180 and 180)
  then
    raise exception 'location_required' using errcode = 'P0001';
  end if;

  -- ── Resolve account ───────────────────────────────────────────────────────
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

  -- ── Load placement ────────────────────────────────────────────────────────
  select p.* into v_placement from world.world_placements p where p.id = p_placement_id for update;
  if v_placement.id is null then
    raise exception 'placement_not_found' using errcode = 'P0001';
  end if;
  if v_placement.visible is not true then
    raise exception 'placement_unavailable' using errcode = 'P0001';
  end if;

  -- ── Proximity check ───────────────────────────────────────────────────────
  v_player_geog    := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_placement_geog := ST_SetSRID(
    ST_MakePoint(v_placement.lng::double precision, v_placement.lat::double precision),
    4326
  )::geography;

  if ST_Distance(v_player_geog, v_placement_geog) > v_collect_radius_m then
    raise exception 'too_far_away' using errcode = 'P0001';
  end if;

  -- ── Model gate — must be a claimable verb ─────────────────────────────────
  -- Claimable verbs: collect (standard grab), check_in (visit stamp).
  -- 'see', 'info', 'route' are display-only and cannot be claimed.
  select m.* into v_model from world.world_models m where m.id = v_placement.model_id;
  if v_model.interaction not in ('collect', 'check_in') then
    raise exception 'not_collectible' using errcode = 'P0001';
  end if;

  -- ── Idempotency ───────────────────────────────────────────────────────────
  if exists (
    select 1 from world.world_collections wc
    where wc.account_id = v_account_id and wc.placement_id = p_placement_id
  ) then
    raise exception 'already_collected' using errcode = 'P0001';
  end if;

  -- ── Rare / capped claim count ─────────────────────────────────────────────
  select count(*)::int into v_claims
  from world.world_collections wc
  where wc.placement_id = p_placement_id;

  v_cap := case
    when v_model.rare then coalesce(v_placement.total_available, 1)
    else v_placement.total_available
  end;

  if v_cap is not null and v_claims >= v_cap then
    update world.world_placements set visible = false where id = p_placement_id;
    raise exception 'placement_unavailable' using errcode = 'P0001';
  end if;

  -- ── Resolve reward ────────────────────────────────────────────────────────
  -- check_in verbs use reward.xp only (no wallet payout).
  v_reward      := v_model.reward;
  v_xp          := coalesce(jsonb_extract_path_text(v_reward, 'xp')::int, 0);
  v_reward_type := jsonb_extract_path_text(v_reward, 'type');
  v_amount      := coalesce(jsonb_extract_path_text(v_reward, 'amount')::int, 1);

  -- Ensure minimum 1 XP for any claim (so it surfaces in activity).
  if v_xp < 1 then v_xp := 1; end if;

  -- ── Write world_collections ───────────────────────────────────────────────
  insert into world.world_collections (account_id, placement_id, model_id, reward, kind)
  values (v_account_id, p_placement_id, v_model.id, v_reward, v_kind);

  -- ── Wallet payout (collect only — not check_in/find) ─────────────────────
  if v_kind = 'collect' and v_reward_type = 'credits' then
    perform wallet.record_transaction(
      p_owner_type      => 'account',
      p_owner_id        => v_account_id,
      p_purse           => 'tool_credits',
      p_amount          => v_amount,
      p_type            => 'reward',
      p_action          => 'collect',
      p_description     => v_model.name || ' collected',
      p_reference_type  => 'world_collection',
      p_reference_id    => p_placement_id,
      p_idempotency_key => 'collect:tool_credits:' || v_account_id::text || ':' || p_placement_id::text
    );
    v_balance := wallet.balance('account', v_account_id, 'tool_credits');
  end if;

  -- ── Cap reached → hide for everyone ──────────────────────────────────────
  -- Common collectibles stay visible; list RPC hides per-account on on_collect=remove.
  if v_cap is not null and (v_claims + 1) >= v_cap then
    update world.world_placements set visible = false where id = p_placement_id;
  end if;

  -- ── XP grant ─────────────────────────────────────────────────────────────
  insert into public.account_xp_transactions (
    account_id, amount, source_type, reference_type, reference_id,
    idempotency_key, claimed_at
  )
  values (
    v_account_id,
    v_xp,
    v_kind,                     -- 'collect' | 'find' | 'check_in'
    'world_collection',
    p_placement_id,
    'xp:' || v_kind || ':' || v_account_id::text || ':' || p_placement_id::text,
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

COMMENT ON FUNCTION world.collect_placement(uuid, double precision, double precision, uuid, text) IS
  'Atomic claim: auth + proximity (820 m) + cap + idempotency + wallet/XP. '
  'Claimable verbs: collect | check_in. p_kind written to world_collections.kind. '
  'Raises location_required, too_far_away, not_collectible, already_collected, placement_unavailable.';

-- Permissions unchanged — same grants as previous version.
REVOKE ALL ON FUNCTION world.collect_placement(uuid, double precision, double precision, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION world.collect_placement(uuid, double precision, double precision, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION world.collect_placement(uuid, double precision, double precision, uuid, text) TO service_role;
