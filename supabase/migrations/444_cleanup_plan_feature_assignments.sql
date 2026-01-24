-- Cleanup orphaned or duplicate plan-feature assignments
-- Remove any assignments that reference non-existent features or plans
-- Ensure we only have the correct assignments based on the 14 features

-- ============================================================================
-- Remove orphaned plan-feature assignments (features or plans that don't exist)
-- ============================================================================

DELETE FROM billing.plan_features
WHERE plan_id NOT IN (SELECT id FROM billing.plans WHERE is_active = true)
   OR feature_id NOT IN (SELECT id FROM billing.features WHERE is_active = true);

-- ============================================================================
-- Remove duplicate assignments (shouldn't happen due to UNIQUE constraint, but just in case)
-- ============================================================================

DELETE FROM billing.plan_features pf1
WHERE EXISTS (
  SELECT 1
  FROM billing.plan_features pf2
  WHERE pf2.plan_id = pf1.plan_id
    AND pf2.feature_id = pf1.feature_id
    AND pf2.id < pf1.id
);

-- ============================================================================
-- Remove any assignments to hobby plan (hobby should have no features)
-- ============================================================================

DELETE FROM billing.plan_features
WHERE plan_id IN (SELECT id FROM billing.plans WHERE slug = 'hobby');

-- ============================================================================
-- Verify and report current assignments
-- ============================================================================

DO $$
DECLARE
  v_total_assignments INTEGER;
  v_contributor_count INTEGER;
  v_professional_count INTEGER;
  v_business_count INTEGER;
  v_hobby_count INTEGER;
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
  
  SELECT COUNT(*) INTO v_hobby_count
  FROM billing.plan_features pf
  INNER JOIN billing.plans p ON pf.plan_id = p.id
  WHERE p.slug = 'hobby';
  
  RAISE NOTICE 'Total plan-feature assignments: %', v_total_assignments;
  RAISE NOTICE 'Hobby: % features (should be 0)', v_hobby_count;
  RAISE NOTICE 'Contributor: % features (should be 7)', v_contributor_count;
  RAISE NOTICE 'Professional: % features (should be 14)', v_professional_count;
  RAISE NOTICE 'Business: % features (should be 14)', v_business_count;
  
  IF v_total_assignments != (v_contributor_count + v_professional_count + v_business_count) THEN
    RAISE WARNING 'Assignment count mismatch detected!';
  END IF;
END $$;
