-- Replace 'pro' plan with 'contributor' plan
-- Updates the plan constraint to use 'contributor' instead of 'pro'
-- Migrates existing 'pro' records to 'contributor'

-- ============================================================================
-- STEP 1: Drop existing constraint (must be done first to allow updates)
-- ============================================================================

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_plan_check;

-- ============================================================================
-- STEP 2: Update existing 'pro' records to 'contributor'
-- ============================================================================

UPDATE public.accounts
SET plan = 'contributor'
WHERE plan = 'pro';

-- ============================================================================
-- STEP 3: Add new constraint with 'contributor' instead of 'pro'
-- ============================================================================

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_plan_check CHECK (plan IN ('hobby', 'contributor', 'plus', 'business', 'gov'));

-- ============================================================================
-- STEP 4: Update comment
-- ============================================================================

COMMENT ON COLUMN public.accounts.plan IS 'Account plan: hobby, contributor, plus, business, or gov';
