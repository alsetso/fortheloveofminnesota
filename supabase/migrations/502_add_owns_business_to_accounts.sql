-- Add owns_business boolean to accounts (optional; used in onboarding)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS owns_business BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN public.accounts.owns_business IS 'Whether the account owner owns a business. Set in onboarding.';
