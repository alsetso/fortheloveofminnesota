-- Force PostgREST to refresh schema cache for billing views
-- This ensures the public views (billing_plans, billing_features, billing_plan_features) are accessible
-- This migration is idempotent - it creates views if they don't exist, then refreshes PostgREST

-- ============================================================================
-- Ensure views exist (create if missing)
-- ============================================================================

-- Create views if they don't exist (idempotent)
CREATE OR REPLACE VIEW public.billing_plans AS
SELECT * FROM billing.plans;

CREATE OR REPLACE VIEW public.billing_features AS
SELECT * FROM billing.features;

CREATE OR REPLACE VIEW public.billing_plan_features AS
SELECT * FROM billing.plan_features;

-- Ensure permissions are set
GRANT SELECT ON public.billing_plans TO authenticated, anon;
GRANT SELECT ON public.billing_features TO authenticated, anon;
GRANT SELECT ON public.billing_plan_features TO authenticated, anon;

-- ============================================================================
-- Force PostgREST schema cache refresh
-- ============================================================================

-- Multiple refresh attempts to ensure it takes
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verify views are accessible (test query)
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Test that we can query the views
  SELECT COUNT(*) INTO v_count FROM public.billing_plans;
  RAISE NOTICE 'billing_plans view accessible: % rows', v_count;
  
  SELECT COUNT(*) INTO v_count FROM public.billing_features;
  RAISE NOTICE 'billing_features view accessible: % rows', v_count;
END $$;
