-- Simplify plans: Remove professional and business, keep only hobby (free) and contributor ($20/month)
-- This migration:
-- 1. Deactivates professional and business plans
-- 2. Ensures hobby is free ($0)
-- 3. Ensures contributor is $20/month ($2000 cents)
-- 4. Updates accounts.plan constraint to remove professional/business

-- ============================================================================
-- STEP 1: Deactivate professional and business plans
-- ============================================================================

UPDATE billing.plans
SET is_active = false,
    updated_at = NOW()
WHERE slug IN ('professional', 'business');

-- ============================================================================
-- STEP 2: Ensure hobby plan is free ($0)
-- ============================================================================

UPDATE billing.plans
SET price_monthly_cents = 0,
    updated_at = NOW()
WHERE slug = 'hobby';

-- ============================================================================
-- STEP 3: Ensure contributor plan is $20/month ($2000 cents)
-- ============================================================================

UPDATE billing.plans
SET price_monthly_cents = 2000,
    updated_at = NOW()
WHERE slug = 'contributor';

-- ============================================================================
-- STEP 4: Update accounts.plan CHECK constraint to remove professional/business
-- ============================================================================

-- Drop existing constraint
ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_plan_check;

-- Add new constraint without professional/business
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_plan_check CHECK (plan IN ('hobby', 'contributor', 'plus', 'gov', 'testing'));

COMMENT ON COLUMN public.accounts.plan IS 'Account plan: hobby (free), contributor ($20/month), plus (deprecated), gov, or testing (admin-only)';

-- ============================================================================
-- STEP 5: Migrate existing professional/business accounts to contributor
-- ============================================================================

-- Migrate professional accounts to contributor
UPDATE public.accounts
SET plan = 'contributor',
    updated_at = NOW()
WHERE plan = 'professional';

-- Migrate business accounts to contributor
UPDATE public.accounts
SET plan = 'contributor',
    updated_at = NOW()
WHERE plan = 'business';

COMMENT ON TABLE billing.plans IS 'Billing plans table. Active plans: hobby (free) and contributor ($20/month). Professional and business plans are deactivated.';
