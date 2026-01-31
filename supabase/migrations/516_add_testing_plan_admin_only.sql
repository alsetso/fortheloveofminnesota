-- Add testing plan for admin-only testing of Stripe webhook flow
-- This plan is only visible to admins and used to test $1/month subscriptions in production

-- ============================================================================
-- STEP 1: Add is_admin_only column to billing.plans
-- ============================================================================

ALTER TABLE billing.plans
  ADD COLUMN IF NOT EXISTS is_admin_only BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_billing_plans_is_admin_only 
  ON billing.plans(is_admin_only) 
  WHERE is_admin_only = true;

COMMENT ON COLUMN billing.plans.is_admin_only IS 
  'If true, plan is only visible to admin users. Used for testing plans.';

-- ============================================================================
-- STEP 2: Insert testing plan
-- ============================================================================

INSERT INTO billing.plans (
  slug,
  name,
  price_monthly_cents,
  display_order,
  description,
  stripe_price_id_monthly,
  is_active,
  is_admin_only
) VALUES (
  'testing',
  'Testing',
  100, -- $1.00/month
  99, -- High display_order so it appears last
  'Admin-only testing plan for Stripe webhook validation',
  'price_1SvlkBRxPcmTLDu9R79ScAQ9',
  true,
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  description = EXCLUDED.description,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  is_admin_only = EXCLUDED.is_admin_only,
  updated_at = NOW();

-- ============================================================================
-- STEP 3: Assign all features to testing plan (same as contributor)
-- ============================================================================

-- Get testing plan ID
DO $$
DECLARE
  v_testing_plan_id UUID;
BEGIN
  SELECT id INTO v_testing_plan_id
  FROM billing.plans
  WHERE slug = 'testing'
  LIMIT 1;
  
  IF v_testing_plan_id IS NOT NULL THEN
    -- Assign all features that contributor plan has
    INSERT INTO billing.plan_features (plan_id, feature_id)
    SELECT v_testing_plan_id, pf.feature_id
    FROM billing.plan_features pf
    INNER JOIN billing.plans p ON pf.plan_id = p.id
    WHERE p.slug = 'contributor'
    ON CONFLICT (plan_id, feature_id) DO NOTHING;
  END IF;
END $$;
