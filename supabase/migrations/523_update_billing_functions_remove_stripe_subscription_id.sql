-- Update billing functions to use subscriptions table instead of stripe_subscription_id
-- This migration updates functions that were checking accounts.stripe_subscription_id

-- ============================================================================
-- STEP 1: Update billing.get_effective_plan_slug function
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
-- STEP 2: Update billing.user_has_feature function
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.user_has_feature(user_id UUID, feature_slug TEXT)
RETURNS BOOLEAN AS $$
  WITH RECURSIVE user_plan AS (
    SELECT a.plan
    FROM accounts a
    WHERE a.user_id = user_id
      AND (
        a.subscription_status = 'active' 
        OR a.subscription_status = 'trialing' 
        OR EXISTS (
          SELECT 1 FROM public.subscriptions s WHERE s.stripe_customer_id = a.stripe_customer_id
        )
      )
    LIMIT 1
  ),
  plan_hierarchy AS (
    -- Base: Get the user's plan
    SELECT p.id, p.slug, p.display_order
    FROM user_plan up
    INNER JOIN billing.plans p ON up.plan = p.slug
    WHERE p.is_active = true
    
    UNION ALL
    
    -- Recursive: Get all lower-tier plans (display_order < current)
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    JOIN plan_hierarchy ph ON p.display_order < ph.display_order
    WHERE p.is_active = true
  )
  SELECT EXISTS (
    SELECT 1
    FROM billing.features f
    INNER JOIN billing.plan_features pf ON f.id = pf.feature_id
    INNER JOIN plan_hierarchy ph ON pf.plan_id = ph.id
    WHERE f.slug = feature_slug
      AND f.is_active = true
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- STEP 3: Update billing.get_user_features function
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.get_user_features(user_id UUID)
RETURNS TABLE(feature_slug TEXT, feature_name TEXT) AS $$
  WITH RECURSIVE user_plan AS (
    SELECT a.plan
    FROM accounts a
    WHERE a.user_id = user_id
      AND (
        a.subscription_status = 'active' 
        OR a.subscription_status = 'trialing' 
        OR EXISTS (
          SELECT 1 FROM public.subscriptions s WHERE s.stripe_customer_id = a.stripe_customer_id
        )
      )
    LIMIT 1
  ),
  plan_hierarchy AS (
    -- Base: Get the user's plan
    SELECT p.id, p.slug, p.display_order
    FROM user_plan up
    INNER JOIN billing.plans p ON up.plan = p.slug
    WHERE p.is_active = true
    
    UNION ALL
    
    -- Recursive: Get all lower-tier plans (display_order < current)
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    JOIN plan_hierarchy ph ON p.display_order < ph.display_order
    WHERE p.is_active = true
  )
  SELECT DISTINCT f.slug, f.name
  FROM billing.features f
  INNER JOIN billing.plan_features pf ON f.id = pf.feature_id
  INNER JOIN plan_hierarchy ph ON pf.plan_id = ph.id
  WHERE f.is_active = true;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- STEP 4: Update billing.get_user_feature_limit function
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.get_user_feature_limit(user_id UUID, feature_slug TEXT)
RETURNS TABLE(
  has_feature BOOLEAN,
  limit_value INTEGER,
  limit_type TEXT,
  is_unlimited BOOLEAN
) AS $$
  WITH user_plan AS (
    SELECT a.plan
    FROM accounts a
    WHERE a.user_id = user_id
      AND (
        a.subscription_status = 'active' 
        OR a.subscription_status = 'trialing' 
        OR EXISTS (
          SELECT 1 FROM public.subscriptions s WHERE s.stripe_customer_id = a.stripe_customer_id
        )
      )
    LIMIT 1
  )
  SELECT 
    EXISTS(SELECT 1 FROM billing.get_plan_features_with_limits((SELECT plan FROM user_plan)) WHERE feature_slug = $2) as has_feature,
    gpf.limit_value,
    gpf.limit_type,
    gpf.is_unlimited
  FROM billing.get_plan_features_with_limits((SELECT plan FROM user_plan)) gpf
  WHERE gpf.feature_slug = $2
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION billing.get_effective_plan_slug IS 'Returns the effective billing plan slug for a specific account (drops to hobby if subscription inactive). Updated to check subscriptions table instead of stripe_subscription_id.';
COMMENT ON FUNCTION billing.user_has_feature IS 'Checks if a user has access to a feature. Updated to check subscriptions table instead of stripe_subscription_id.';
COMMENT ON FUNCTION billing.get_user_features IS 'Returns all features for a user. Updated to check subscriptions table instead of stripe_subscription_id.';
COMMENT ON FUNCTION billing.get_user_feature_limit IS 'Returns a single feature limit row for a user. Updated to check subscriptions table instead of stripe_subscription_id.';
