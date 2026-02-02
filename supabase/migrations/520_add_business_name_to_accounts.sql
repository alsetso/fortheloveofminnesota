-- Add business_name text to accounts (optional; used when owns_business is true)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS business_name TEXT DEFAULT NULL;

COMMENT ON COLUMN public.accounts.business_name IS 'Name or website of the business owned by the account owner. Set in onboarding when owns_business is true.';
