-- Fix plan-feature assignments to avoid duplicates
-- Higher-tier plans should ONLY have NEW features, not duplicate lower-tier features
-- Lower-tier features are inherited automatically via the get_plan_features function

-- ============================================================================
-- Clear all existing assignments
-- ============================================================================

TRUNCATE TABLE billing.plan_features;

-- ============================================================================
-- Contributor plan: Base features (7 features)
-- ============================================================================

INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'contributor'
  AND f.slug IN (
    'unlimited_maps',
    'visitor_analytics',
    'all_time_historical_data',
    'extended_text',
    'video_uploads',
    'unlimited_collections',
    'gold_profile_border'
  )
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ============================================================================
-- Professional plan: NEW features only (7 new features, not the 7 from contributor)
-- ============================================================================

INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'professional'
  AND f.slug IN (
    'visitor_identities',
    'time_series_charts',
    'export_data',
    'geographic_data',
    'referrer_tracking',
    'real_time_updates',
    'advanced_profile_features'
  )
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ============================================================================
-- Business plan: No new features (inherits all from professional)
-- If you want business to have unique features, add them here
-- ============================================================================

-- Business currently has no unique features, it inherits all from professional
-- Uncomment and add features if business should have unique ones:
-- INSERT INTO billing.plan_features (plan_id, feature_id)
-- SELECT p.id, f.id
-- FROM billing.plans p
-- CROSS JOIN billing.features f
-- WHERE p.slug = 'business'
--   AND f.slug IN (
--     -- Add business-specific features here
--   )
-- ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ============================================================================
-- Verify assignments
-- ============================================================================

DO $$
DECLARE
  v_total_assignments INTEGER;
  v_contributor_count INTEGER;
  v_professional_count INTEGER;
  v_business_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_assignments FROM billing.plan_features;
  
  SELECT COUNT(*) INTO v_contributor_count
  FROM billing.plan_features pf
  INNER JOIN billing.plans p ON pf.plan_id = p.id
  WHERE p.slug = 'contributor';
  
  SELECT COUNT(*) INTO v_professional_count
  FROM billing.plan_features pf
  INNER JOIN billing.plans p ON pf.plan_id = p.id
  WHERE p.slug = 'professional';
  
  SELECT COUNT(*) INTO v_business_count
  FROM billing.plan_features pf
  INNER JOIN billing.plans p ON pf.plan_id = p.id
  WHERE p.slug = 'business';
  
  RAISE NOTICE 'Total plan-feature assignments: % (should be 14)', v_total_assignments;
  RAISE NOTICE 'Contributor: % features (should be 7)', v_contributor_count;
  RAISE NOTICE 'Professional: % features (should be 7)', v_professional_count;
  RAISE NOTICE 'Business: % features (should be 0)', v_business_count;
  
  IF v_total_assignments != 14 THEN
    RAISE WARNING 'Expected 14 total assignments (7 contributor + 7 professional), got %', v_total_assignments;
  END IF;
END $$;
