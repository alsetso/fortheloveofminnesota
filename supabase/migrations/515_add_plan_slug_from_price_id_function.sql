-- Add helper function to map Stripe price_id to billing plan slug
-- This enables webhook to correctly update accounts.plan based on subscription price_id

-- ============================================================================
-- STEP 1: Create function to get plan slug from Stripe price ID
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.get_plan_slug_from_price_id(p_price_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_plan_slug TEXT;
BEGIN
  -- Look up plan by matching price_id to either monthly or yearly price ID
  SELECT slug INTO v_plan_slug
  FROM billing.plans
  WHERE (stripe_price_id_monthly = p_price_id OR stripe_price_id_yearly = p_price_id)
    AND is_active = true
  LIMIT 1;
  
  RETURN v_plan_slug;
END;
$$;

COMMENT ON FUNCTION billing.get_plan_slug_from_price_id IS 
  'Maps a Stripe price_id to the corresponding billing plan slug. Returns NULL if no match found.';

-- ============================================================================
-- STEP 2: Grant execute permission
-- ============================================================================

GRANT EXECUTE ON FUNCTION billing.get_plan_slug_from_price_id TO authenticated, anon, service_role;
