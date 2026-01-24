-- Update accounts.plan constraint to include 'professional' plan
-- Migrate existing 'plus' plan users to 'professional'
-- Keep 'plus' in constraint during transition for safety

-- ============================================================================
-- STEP 1: Drop existing constraint
-- ============================================================================

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_plan_check;

-- ============================================================================
-- STEP 2: Migrate 'plus' plan users to 'professional'
-- ============================================================================

UPDATE public.accounts
SET plan = 'professional'
WHERE plan = 'plus';

-- ============================================================================
-- STEP 3: Add new constraint with 'professional' included
-- Keep 'plus' for backward compatibility during transition
-- ============================================================================

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_plan_check CHECK (plan IN ('hobby', 'contributor', 'plus', 'professional', 'business', 'gov'));

-- ============================================================================
-- STEP 4: Update comment
-- ============================================================================

COMMENT ON COLUMN public.accounts.plan IS 'Account plan: hobby, contributor, plus (deprecated), professional, business, or gov';
