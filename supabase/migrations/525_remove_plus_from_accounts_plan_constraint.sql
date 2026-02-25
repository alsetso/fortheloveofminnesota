-- Remove 'plus' from accounts.plan constraint (archived plan)
-- New allowed values: hobby, contributor, gov, testing

-- ============================================================================
-- STEP 1: Migrate any existing plus accounts to contributor
-- ============================================================================

UPDATE public.accounts
SET plan = 'contributor',
    updated_at = NOW()
WHERE plan = 'plus';

-- ============================================================================
-- STEP 2: Drop existing constraint
-- ============================================================================

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_plan_check;

-- ============================================================================
-- STEP 3: Add new constraint without plus
-- ============================================================================

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_plan_check CHECK (plan IN ('hobby', 'contributor', 'gov', 'testing'));

COMMENT ON COLUMN public.accounts.plan IS 'Account plan: hobby (free), contributor ($20/month), gov, or testing (admin-only). Plus is archived.';
