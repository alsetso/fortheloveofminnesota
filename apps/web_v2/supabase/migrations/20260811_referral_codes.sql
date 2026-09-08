-- Referral code system — admin-authored codes with typed reward bundles.
-- Supports XP, credits, collectibles, page claims, zone access, badges.
-- Phase 1: XP + credits grants are executed inside redeem_referral_code().
-- Phase 2: collectibles/page_claim/zone_access will be dispatched async.

-- ─── 1. XP source type ────────────────────────────────────────────────────────

-- Add 'referral' to the allowed source_type values on XP transactions.
ALTER TABLE public.account_xp_transactions
  DROP CONSTRAINT IF EXISTS account_xp_transactions_source_type_check;
ALTER TABLE public.account_xp_transactions
  ADD CONSTRAINT account_xp_transactions_source_type_check
  CHECK (source_type IN ('collect', 'territory_unlock', 'daily_streak', 'bonus', 'gift', 'referral'));

-- ─── 2. Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL,                    -- uppercase slug, e.g. MNLOVE26
  title         text NOT NULL,                    -- admin display name
  description   text,                             -- shown to player in modal
  created_by    uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  referrer_id   uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'active',
  max_uses      integer,                           -- null = unlimited
  use_count     integer NOT NULL DEFAULT 0,
  expires_at    timestamptz,                       -- null = never
  scope         jsonb NOT NULL DEFAULT '{}',       -- { zone_id?, event_id? }
  rewards       jsonb NOT NULL DEFAULT '[]',       -- redeemer reward descriptors
  referrer_rewards jsonb NOT NULL DEFAULT '[]',    -- per-use referrer grants
  milestone_rules  jsonb NOT NULL DEFAULT '[]',   -- tiered referrer bonuses
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_codes_code_unique UNIQUE (code),
  CONSTRAINT referral_codes_status_check CHECK (status IN ('active', 'paused', 'expired')),
  CONSTRAINT referral_codes_max_uses_check CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT referral_codes_use_count_check CHECK (use_count >= 0)
);

COMMENT ON TABLE public.referral_codes IS
  'Admin-authored referral codes with JSON reward bundles (XP, credits, collectibles, badges, page claims).';
COMMENT ON COLUMN public.referral_codes.code IS
  'Uppercase human-readable slug. Normalised to UPPER before insert.';
COMMENT ON COLUMN public.referral_codes.rewards IS
  'Array of { type, amount?, item_id?, page_id?, zone_id?, duration_days?, label } descriptors.';

CREATE INDEX IF NOT EXISTS referral_codes_code_idx ON public.referral_codes (code);
CREATE INDEX IF NOT EXISTS referral_codes_status_idx ON public.referral_codes (status);
CREATE INDEX IF NOT EXISTS referral_codes_created_by_idx ON public.referral_codes (created_by) WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referral_code_uses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id       uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  account_id    uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  used_at       timestamptz NOT NULL DEFAULT now(),
  rewards_granted jsonb NOT NULL DEFAULT '[]',
  referrer_rewards_granted jsonb NOT NULL DEFAULT '[]',
  status        text NOT NULL DEFAULT 'pending',
  error         text,

  CONSTRAINT referral_code_uses_unique UNIQUE (code_id, account_id),
  CONSTRAINT referral_code_uses_status_check CHECK (status IN ('pending', 'granted', 'failed'))
);

COMMENT ON TABLE public.referral_code_uses IS
  'Per-account redemption records. UNIQUE(code_id, account_id) enforces one use per player.';

CREATE INDEX IF NOT EXISTS referral_code_uses_code_id_idx ON public.referral_code_uses (code_id);
CREATE INDEX IF NOT EXISTS referral_code_uses_account_id_idx ON public.referral_code_uses (account_id);

-- ─── 3. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_referral_codes_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS referral_codes_updated_at ON public.referral_codes;
CREATE TRIGGER referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_codes_updated_at();

-- ─── 4. RPC: preview (public — no auth required) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.preview_referral_code(
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_code public.referral_codes%ROWTYPE;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RAISE EXCEPTION 'code_not_found';
  END IF;

  SELECT * INTO v_code
  FROM public.referral_codes
  WHERE code = upper(btrim(p_code));

  IF NOT FOUND OR v_code.status <> 'active' THEN
    RAISE EXCEPTION 'code_not_found';
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RAISE EXCEPTION 'code_expired';
  END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.use_count >= v_code.max_uses THEN
    RAISE EXCEPTION 'code_maxed';
  END IF;

  RETURN jsonb_build_object(
    'code',        v_code.code,
    'title',       v_code.title,
    'description', v_code.description,
    'rewards',     v_code.rewards,
    'expires_at',  v_code.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_referral_code(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.preview_referral_code IS
  'Returns reward preview for a code without redeeming it. Safe to call unauthenticated.';

-- ─── 5. RPC: redeem (authenticated — grants rewards in one transaction) ───────

CREATE OR REPLACE FUNCTION public.redeem_referral_code(
  p_code       text,
  p_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'world', 'wallet', 'extensions'
AS $body$
DECLARE
  v_code          public.referral_codes%ROWTYPE;
  v_use_id        uuid;
  v_reward        jsonb;
  v_xp_total      integer := 0;
  v_credits_total integer := 0;
  v_level_row     public.account_level_state%ROWTYPE;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN RAISE EXCEPTION 'code_not_found'; END IF;
  IF p_account_id IS NULL THEN RAISE EXCEPTION 'account_required'; END IF;

  -- Lock the code row so concurrent redeems can't exceed max_uses.
  SELECT * INTO v_code FROM public.referral_codes
  WHERE code = upper(btrim(p_code)) FOR UPDATE;

  IF NOT FOUND OR v_code.status <> 'active' THEN RAISE EXCEPTION 'code_not_found'; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN RAISE EXCEPTION 'code_expired'; END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.use_count >= v_code.max_uses THEN RAISE EXCEPTION 'code_maxed'; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_code_uses WHERE code_id = v_code.id AND account_id = p_account_id) THEN
    RAISE EXCEPTION 'already_redeemed';
  END IF;

  INSERT INTO public.referral_code_uses (code_id, account_id, status)
  VALUES (v_code.id, p_account_id, 'pending') RETURNING id INTO v_use_id;

  -- Grant redeemer rewards.
  FOR v_reward IN SELECT * FROM jsonb_array_elements(v_code.rewards) LOOP
    IF v_reward->>'type' = 'xp' THEN
      v_xp_total := v_xp_total + COALESCE((v_reward->>'amount')::integer, 0);
      INSERT INTO public.account_xp_transactions
        (account_id, amount, source_type, reference_type, reference_id, idempotency_key, claimed_at)
      VALUES
        (p_account_id, COALESCE((v_reward->>'amount')::integer, 0), 'referral', 'referral_code', v_code.id,
         'xp:referral:' || v_code.id::text || ':' || p_account_id::text, now())
      ON CONFLICT (idempotency_key) DO NOTHING;
    ELSIF v_reward->>'type' = 'credits' THEN
      v_credits_total := v_credits_total + COALESCE((v_reward->>'amount')::integer, 0);
      PERFORM wallet.record_transaction(
        p_owner_type => 'account', p_owner_id => p_account_id, p_purse => 'tool_credits',
        p_amount => COALESCE((v_reward->>'amount')::integer, 0), p_type => 'reward',
        p_action => 'referral_code', p_reference_id => v_code.id);
    END IF;
    -- Phase 2: collectible, badge, page_claim, zone_access dispatched async.
  END LOOP;

  UPDATE public.referral_code_uses SET status = 'granted', rewards_granted = v_code.rewards WHERE id = v_use_id;
  UPDATE public.referral_codes SET use_count = use_count + 1 WHERE id = v_code.id;

  IF v_xp_total > 0 THEN
    SELECT * INTO v_level_row FROM public.recompute_account_level(p_account_id);
  ELSE
    SELECT * INTO v_level_row FROM public.account_level_state WHERE account_id = p_account_id;
  END IF;

  -- Grant referrer rewards (per-use payout to the person who shared the code).
  IF v_code.referrer_id IS NOT NULL AND jsonb_array_length(v_code.referrer_rewards) > 0 THEN
    FOR v_reward IN SELECT * FROM jsonb_array_elements(v_code.referrer_rewards) LOOP
      IF v_reward->>'type' = 'xp' THEN
        INSERT INTO public.account_xp_transactions
          (account_id, amount, source_type, reference_type, reference_id, idempotency_key, claimed_at)
        VALUES
          (v_code.referrer_id, COALESCE((v_reward->>'amount')::integer, 0), 'referral', 'referral_code_referrer', v_code.id,
           'xp:referrer:' || v_code.id::text || ':' || p_account_id::text, now())
        ON CONFLICT (idempotency_key) DO NOTHING;
      ELSIF v_reward->>'type' = 'credits' THEN
        PERFORM wallet.record_transaction(
          p_owner_type => 'account', p_owner_id => v_code.referrer_id, p_purse => 'tool_credits',
          p_amount => COALESCE((v_reward->>'amount')::integer, 0), p_type => 'reward',
          p_action => 'referral_code_referrer', p_reference_id => v_code.id);
      END IF;
    END LOOP;
    PERFORM public.recompute_account_level(v_code.referrer_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'code', v_code.code, 'title', v_code.title, 'description', v_code.description,
    'rewards', v_code.rewards, 'xp_granted', v_xp_total, 'credits_granted', v_credits_total,
    'level', COALESCE(v_level_row.level, 1), 'total_xp', COALESCE(v_level_row.total_xp, 0));
END;
$body$;

REVOKE ALL ON FUNCTION public.redeem_referral_code(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.redeem_referral_code IS
  'Atomically redeems a referral code for an account: validates, grants XP+credits, records use.';

-- ─── 6. RPC: admin list ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_referral_codes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',               c.id,
        'code',             c.code,
        'title',            c.title,
        'description',      c.description,
        'status',           c.status,
        'max_uses',         c.max_uses,
        'use_count',        c.use_count,
        'expires_at',       c.expires_at,
        'scope',            c.scope,
        'rewards',          c.rewards,
        'referrer_rewards', c.referrer_rewards,
        'milestone_rules',  c.milestone_rules,
        'metadata',         c.metadata,
        'created_by',       c.created_by,
        'referrer_id',      c.referrer_id,
        'created_at',       c.created_at,
        'updated_at',       c.updated_at
      ) ORDER BY c.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.referral_codes c;

  RETURN jsonb_build_object('codes', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_referral_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_referral_codes() TO service_role;

-- ─── 7. RPC: admin get uses ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_referral_code_uses(p_code_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',              u.id,
        'account_id',      u.account_id,
        'used_at',         u.used_at,
        'status',          u.status,
        'rewards_granted', u.rewards_granted,
        'xp_granted',      (
          SELECT COALESCE(SUM((r->>'amount')::integer), 0)
          FROM jsonb_array_elements(u.rewards_granted) r
          WHERE r->>'type' = 'xp'
        ),
        'credits_granted', (
          SELECT COALESCE(SUM((r->>'amount')::integer), 0)
          FROM jsonb_array_elements(u.rewards_granted) r
          WHERE r->>'type' = 'credits'
        )
      ) ORDER BY u.used_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.referral_code_uses u
  WHERE u.code_id = p_code_id;

  RETURN jsonb_build_object('uses', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_referral_code_uses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_referral_code_uses(uuid) TO service_role;

-- ─── 8. Table GRANTs ─────────────────────────────────────────────────────────
-- Tables created via raw SQL don't inherit Supabase's automatic role grants.
-- service_role bypasses RLS but still needs table-level access.
-- Mutations only happen through SECURITY DEFINER RPCs, so authenticated
-- gets SELECT only; RLS policies further restrict which rows are visible.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_codes TO service_role;
GRANT SELECT ON public.referral_codes TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_code_uses TO service_role;
GRANT SELECT ON public.referral_code_uses TO authenticated;

-- ─── 9. RLS ───────────────────────────────────────────────────────────────────

-- referral_codes
-- Direct table access is admin/service-role only.
-- Authenticated users interact exclusively through SECURITY DEFINER RPCs.

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS by default in Supabase — no explicit policy needed.
-- Expose active codes as read-only to authenticated so deep-links and previews
-- can optionally skip the RPC when the full row isn't sensitive.
CREATE POLICY "referral_codes: authenticated can read active"
  ON public.referral_codes
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- referral_code_uses
-- Users may only see their own redemption records.

ALTER TABLE public.referral_code_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_code_uses: owner can read own"
  ON public.referral_code_uses
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies — mutations happen inside SECURITY DEFINER RPCs.
