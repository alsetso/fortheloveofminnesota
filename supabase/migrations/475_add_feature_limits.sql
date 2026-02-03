-- Add feature limits to plan_features junction table
-- This allows each feature to have different limits per plan

-- ============================================================================
-- Add limit columns to plan_features
-- ============================================================================

ALTER TABLE billing.plan_features 
  ADD COLUMN limit_value INTEGER,
  ADD COLUMN limit_type TEXT CHECK (limit_type IN ('count', 'storage_mb', 'boolean', 'unlimited'));

-- ============================================================================
-- Add comments
-- ============================================================================

COMMENT ON COLUMN billing.plan_features.limit_value IS 'Numeric limit for this feature on this plan (e.g., 5 for "5 groups", NULL for unlimited)';
COMMENT ON COLUMN billing.plan_features.limit_type IS 'Type of limit: count (numeric), storage_mb (file storage), boolean (yes/no), unlimited (no limit)';

-- ============================================================================
-- Example: Update existing features with limits
-- ============================================================================

-- Groups feature limits
UPDATE billing.plan_features pf
SET limit_value = 5, limit_type = 'count'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug = 'groups'
  AND p.slug = 'contributor';

UPDATE billing.plan_features pf
SET limit_value = 5, limit_type = 'count'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug = 'groups'
  AND p.slug = 'professional';

UPDATE billing.plan_features pf
SET limit_value = 10, limit_type = 'count'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug = 'groups'
  AND p.slug = 'business';

-- Custom Maps limits (Hobby has limited, others unlimited)
UPDATE billing.plan_features pf
SET limit_value = 3, limit_type = 'count'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug = 'custom_maps'
  AND p.slug = 'hobby';

UPDATE billing.plan_features pf
SET limit_value = NULL, limit_type = 'unlimited'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug = 'unlimited_maps'
  AND p.slug IN ('contributor', 'professional', 'business');

-- Collections limits
UPDATE billing.plan_features pf
SET limit_value = 5, limit_type = 'count'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug = 'collections'
  AND p.slug = 'hobby';

UPDATE billing.plan_features pf
SET limit_value = NULL, limit_type = 'unlimited'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug = 'unlimited_collections'
  AND p.slug IN ('contributor', 'professional', 'business');

-- Storage limits (example: video uploads)
UPDATE billing.plan_features pf
SET limit_value = 1000, limit_type = 'storage_mb'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug = 'video_uploads'
  AND p.slug = 'contributor';

UPDATE billing.plan_features pf
SET limit_value = 5000, limit_type = 'storage_mb'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug = 'video_uploads'
  AND p.slug IN ('professional', 'business');

-- Boolean features (yes/no access)
UPDATE billing.plan_features pf
SET limit_value = 1, limit_type = 'boolean'
FROM billing.features f, billing.plans p
WHERE pf.feature_id = f.id 
  AND pf.plan_id = p.id
  AND f.slug IN ('gold_profile_border', 'advanced_profile_features', 'all_time_historical_data');

-- ============================================================================
-- Update helper function to include limits
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.get_plan_features_with_limits(plan_slug TEXT)
RETURNS TABLE(
  feature_slug TEXT, 
  feature_name TEXT, 
  limit_value INTEGER, 
  limit_type TEXT,
  is_unlimited BOOLEAN
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
    (pf.limit_type = 'unlimited' OR pf.limit_value IS NULL) as is_unlimited
  FROM billing.features f
  INNER JOIN billing.plan_features pf ON f.id = pf.feature_id
  INNER JOIN plan_hierarchy ph ON pf.plan_id = ph.id
  WHERE f.is_active = true
  ORDER BY f.slug, ph.display_order DESC -- Prefer current plan's limit over inherited
$$ LANGUAGE SQL STABLE;

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

COMMENT ON FUNCTION billing.get_plan_features_with_limits IS 'Returns all features for a plan with their limits';
COMMENT ON FUNCTION billing.get_user_feature_limit IS 'Gets the limit for a specific feature for a user';
