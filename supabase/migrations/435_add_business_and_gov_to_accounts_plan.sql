-- Add 'business' and 'gov' plan options to accounts.plan CHECK constraint
-- Updates the plan constraint to allow 'hobby', 'contributor', 'plus', 'business', and 'gov'

-- ============================================================================
-- STEP 1: Drop existing constraint
-- ============================================================================

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_plan_check;

-- ============================================================================
-- STEP 2: Add new constraint with 'business' and 'gov' options
-- ============================================================================

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_plan_check CHECK (plan IN ('hobby', 'contributor', 'plus', 'business', 'gov'));

-- ============================================================================
-- STEP 3: Update comment
-- ============================================================================

COMMENT ON COLUMN public.accounts.plan IS 'Account plan: hobby, contributor, plus, business, or gov';
