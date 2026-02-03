-- Remove stripe_subscription_id from accounts table
-- Subscription ID is now tracked in subscriptions table only
-- Use JOIN via stripe_customer_id to get subscription_id when needed

-- ============================================================================
-- STEP 1: Drop index on stripe_subscription_id
-- ============================================================================

DROP INDEX IF EXISTS idx_accounts_stripe_subscription_id;

-- ============================================================================
-- STEP 2: Drop column from accounts table
-- ============================================================================

ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS stripe_subscription_id;

-- ============================================================================
-- STEP 3: Add comment documenting the change
-- ============================================================================

COMMENT ON TABLE public.accounts IS 
  'User accounts table. Subscription ID is tracked in subscriptions table via stripe_customer_id.';
