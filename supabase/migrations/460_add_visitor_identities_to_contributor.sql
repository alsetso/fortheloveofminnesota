-- Add visitor_identities feature to Contributor plan
-- This allows Contributor plan users to see who viewed their content

-- ============================================================================
-- Add visitor_identities to Contributor plan
-- ============================================================================

INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'contributor'
  AND f.slug = 'visitor_identities'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ============================================================================
-- Remove visitor_identities from Professional plan
-- Since Professional inherits from Contributor, it will automatically get this feature
-- This follows the pattern where higher-tier plans only have NEW features
-- ============================================================================

DELETE FROM billing.plan_features pf
USING billing.plans p, billing.features f
WHERE pf.plan_id = p.id
  AND pf.feature_id = f.id
  AND p.slug = 'professional'
  AND f.slug = 'visitor_identities';

-- ============================================================================
-- Verify the change
-- ============================================================================

DO $$
DECLARE
  v_contributor_has_feature BOOLEAN;
  v_professional_has_feature BOOLEAN;
BEGIN
  -- Check if Contributor has visitor_identities
  SELECT EXISTS (
    SELECT 1
    FROM billing.plan_features pf
    INNER JOIN billing.plans p ON pf.plan_id = p.id
    INNER JOIN billing.features f ON pf.feature_id = f.id
    WHERE p.slug = 'contributor'
      AND f.slug = 'visitor_identities'
  ) INTO v_contributor_has_feature;
  
  -- Check if Professional still has it explicitly (should be false after deletion)
  SELECT EXISTS (
    SELECT 1
    FROM billing.plan_features pf
    INNER JOIN billing.plans p ON pf.plan_id = p.id
    INNER JOIN billing.features f ON pf.feature_id = f.id
    WHERE p.slug = 'professional'
      AND f.slug = 'visitor_identities'
  ) INTO v_professional_has_feature;
  
  IF v_contributor_has_feature THEN
    RAISE NOTICE '✅ Contributor plan now has visitor_identities feature';
  ELSE
    RAISE WARNING '❌ Contributor plan does NOT have visitor_identities feature';
  END IF;
  
  IF NOT v_professional_has_feature THEN
    RAISE NOTICE '✅ Professional plan no longer has visitor_identities explicitly (will inherit from Contributor)';
  ELSE
    RAISE WARNING '❌ Professional plan still has visitor_identities explicitly (should be removed)';
  END IF;
END $$;
