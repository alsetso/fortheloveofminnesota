-- Hearts are collection progress (world_collections vs placements), not a balance.
-- Stop crediting public.account_hearts; drop the ledger table.

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
begin
  if v_user is null then
    raise exception 'Not authenticated';
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

  v_reward := v_model.reward;
  v_xp := coalesce((v_reward->>'xp')::int, 1);
  v_reward_type := v_reward->>'type';
  v_amount := coalesce((v_reward->>'amount')::int, 1);

  insert into world.world_collections (account_id, placement_id, model_id, reward)
  values (v_account_id, p_placement_id, v_model.id, v_reward);

  -- Credits → spendable wallet. Hearts → collection progress only (no balance).
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

  if v_model.on_collect = 'remove' then
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
    p_placement_id,
    v_model.slug,
    v_reward,
    v_balance,
    v_level.total_xp,
    v_level.level,
    v_level.highest_level_reached;
end;
$function$;

DROP TABLE IF EXISTS public.account_hearts CASCADE;
