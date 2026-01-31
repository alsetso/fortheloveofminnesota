-- Add 'testing' plan option to accounts.plan CHECK constraint
-- Required for admin-only testing plan to work with webhook updates

-- ============================================================================
-- STEP 1: Drop existing constraint
-- ============================================================================

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_plan_check;

-- ============================================================================
-- STEP 2: Add new constraint with 'testing' included
-- ============================================================================

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_plan_check CHECK (plan IN ('hobby', 'contributor', 'plus', 'professional', 'business', 'gov', 'testing'));

-- ============================================================================
-- STEP 3: Update comment
-- ============================================================================

COMMENT ON COLUMN public.accounts.plan IS 'Account plan: hobby, contributor, plus (deprecated), professional, business, gov, or testing (admin-only)';
