-- Account-scoped billing feature access
-- Fixes ambiguity when a user has multiple accounts with different plans

-- ============================================================================
-- billing: normalize effective plan for an account
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.get_effective_plan_slug(account_id UUID)
RETURNS TEXT AS $$
  SELECT
    CASE
      -- Default: hobby
      WHEN a.plan IS NULL OR a.plan = '' OR a.plan = 'hobby' THEN 'hobby'
      -- Legacy: plus behaves like contributor in billing schema
      WHEN a.plan = 'plus' THEN
        CASE
          WHEN a.subscription_status IN ('active', 'trialing') OR EXISTS (
            SELECT 1 FROM public.subscriptions s WHERE s.stripe_customer_id = a.stripe_customer_id
          ) THEN 'contributor'
          ELSE 'hobby'
        END
      -- Paid plans require active/trialing or comped (subscription exists)
      WHEN a.subscription_status IN ('active', 'trialing') OR EXISTS (
        SELECT 1 FROM public.subscriptions s WHERE s.stripe_customer_id = a.stripe_customer_id
      ) THEN a.plan
      -- Subscription lapsed: drop to hobby
      ELSE 'hobby'
    END
  FROM public.accounts a
  WHERE a.id = $1
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- billing: account feature access + limits
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.account_has_feature(account_id UUID, feature_slug TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM billing.get_plan_features_with_limits(billing.get_effective_plan_slug($1)) f
    WHERE f.feature_slug = $2
  );
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION billing.get_account_features_with_limits(account_id UUID)
RETURNS TABLE(
  feature_slug TEXT,
  feature_name TEXT,
  limit_value INTEGER,
  limit_type TEXT,
  is_unlimited BOOLEAN
) AS $$
  SELECT *
  FROM billing.get_plan_features_with_limits(billing.get_effective_plan_slug($1));
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION billing.get_account_feature_limit(account_id UUID, feature_slug TEXT)
RETURNS TABLE(
  has_feature BOOLEAN,
  limit_value INTEGER,
  limit_type TEXT,
  is_unlimited BOOLEAN
) AS $$
  SELECT
    EXISTS(
      SELECT 1
      FROM billing.get_account_features_with_limits($1) af
      WHERE af.feature_slug = $2
    ) AS has_feature,
    af.limit_value,
    af.limit_type,
    af.is_unlimited
  FROM billing.get_account_features_with_limits($1) af
  WHERE af.feature_slug = $2
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION billing.get_effective_plan_slug IS 'Returns the effective billing plan slug for a specific account (drops to hobby if subscription inactive)';
COMMENT ON FUNCTION billing.account_has_feature IS 'Checks if an account has access to a feature based on its effective plan';
COMMENT ON FUNCTION billing.get_account_features_with_limits IS 'Returns all features available to an account (including inherited) with limits';
COMMENT ON FUNCTION billing.get_account_feature_limit IS 'Returns a single feature limit row for an account';

-- ============================================================================
-- public: PostgREST-exposed wrappers (ownership checked)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.account_has_feature(account_id UUID, feature_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, billing
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = account_id
      AND a.user_id = auth.uid()
    LIMIT 1
  ) THEN
    RETURN FALSE;
  END IF;

  RETURN billing.account_has_feature(account_id, feature_slug);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_account_features_with_limits(account_id UUID)
RETURNS TABLE(
  feature_slug TEXT,
  feature_name TEXT,
  limit_value INTEGER,
  limit_type TEXT,
  is_unlimited BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, billing
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = account_id
      AND a.user_id = auth.uid()
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT *
    FROM billing.get_account_features_with_limits(account_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_account_feature_limit(account_id UUID, feature_slug TEXT)
RETURNS TABLE(
  has_feature BOOLEAN,
  limit_value INTEGER,
  limit_type TEXT,
  is_unlimited BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, billing
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = account_id
      AND a.user_id = auth.uid()
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT *
    FROM billing.get_account_feature_limit(account_id, feature_slug);
END;
$$;

-- Grant execute permissions (authenticated only)
GRANT EXECUTE ON FUNCTION public.account_has_feature(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_features_with_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_feature_limit(UUID, TEXT) TO authenticated;

-- Also grant on billing schema functions (in case schema is exposed later)
GRANT EXECUTE ON FUNCTION billing.get_effective_plan_slug(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION billing.account_has_feature(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION billing.get_account_features_with_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION billing.get_account_feature_limit(UUID, TEXT) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

