-- Add 'plus' plan option to accounts.plan CHECK constraint
-- Updates the plan constraint to allow 'hobby', 'pro', and 'plus'

-- ============================================================================
-- STEP 1: Drop existing constraint
-- ============================================================================

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_plan_check;

-- ============================================================================
-- STEP 2: Add new constraint with 'plus' option
-- ============================================================================

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_plan_check CHECK (plan IN ('hobby', 'pro', 'plus'));

-- ============================================================================
-- STEP 3: Update comment
-- ============================================================================

COMMENT ON COLUMN public.accounts.plan IS 'Account plan: hobby, pro, or plus';
