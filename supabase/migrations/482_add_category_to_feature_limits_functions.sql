-- Add category to feature limits functions
-- This allows UI to group features by category and determine icons automatically

-- ============================================================================
-- Drop existing functions first (to change return type)
-- Must drop dependent functions first, then recreate in reverse order
-- ============================================================================

-- Drop functions that depend on get_account_features_with_limits
DROP FUNCTION IF EXISTS billing.get_account_feature_limit(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_account_features_with_limits(UUID);
DROP FUNCTION IF EXISTS public.account_has_feature(UUID, TEXT);

-- Drop the account-scoped functions
DROP FUNCTION IF EXISTS billing.get_account_features_with_limits(UUID);

-- Drop the plan function (this is the base function)
DROP FUNCTION IF EXISTS billing.get_plan_features_with_limits(TEXT);

-- ============================================================================
-- Recreate get_plan_features_with_limits with category
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.get_plan_features_with_limits(plan_slug TEXT)
RETURNS TABLE(
  feature_slug TEXT, 
  feature_name TEXT, 
  limit_value INTEGER, 
  limit_type TEXT,
  is_unlimited BOOLEAN,
  category TEXT
) AS $$
  WITH RECURSIVE plan_hierarchy AS (
    -- Base: Get the plan
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    WHERE p.slug = plan_slug AND p.is_active = true
    
    UNION ALL
    
    -- Recursive: Get all lower-tier plans (display_order < current)
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    JOIN plan_hierarchy ph ON p.display_order < ph.display_order
    WHERE p.is_active = true
  )
  SELECT DISTINCT ON (f.slug) 
    f.slug, 
    f.name,
    pf.limit_value,
    pf.limit_type,
    (pf.limit_type = 'unlimited' OR pf.limit_value IS NULL) as is_unlimited,
    f.category
  FROM billing.features f
  INNER JOIN billing.plan_features pf ON f.id = pf.feature_id
  INNER JOIN plan_hierarchy ph ON pf.plan_id = ph.id
  WHERE f.is_active = true
  ORDER BY f.slug, ph.display_order DESC -- Prefer current plan's limit over inherited
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- Update get_account_features_with_limits to include category
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.get_account_features_with_limits(account_id UUID)
RETURNS TABLE(
  feature_slug TEXT,
  feature_name TEXT,
  limit_value INTEGER,
  limit_type TEXT,
  is_unlimited BOOLEAN,
  category TEXT
) AS $$
  SELECT *
  FROM billing.get_plan_features_with_limits(billing.get_effective_plan_slug($1));
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- Recreate dependent functions that were dropped
-- ============================================================================

-- Recreate get_account_feature_limit (depends on get_account_features_with_limits)
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

-- Recreate public wrapper functions (from migration 479)
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
  is_unlimited BOOLEAN,
  category TEXT
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

COMMENT ON FUNCTION billing.get_plan_features_with_limits IS 'Returns all features for a plan with their limits and category';
COMMENT ON FUNCTION billing.get_account_features_with_limits IS 'Returns all features available to an account (including inherited) with limits and category';
COMMENT ON FUNCTION billing.get_account_feature_limit IS 'Returns a single feature limit row for an account';
