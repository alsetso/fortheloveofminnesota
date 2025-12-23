-- Add email and phone columns to accounts table
-- These fields are editable by the account owner

-- ============================================================================
-- STEP 1: Add email and phone columns
-- ============================================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================================
-- STEP 2: Create indexes for email and phone lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS accounts_email_idx
  ON public.accounts (email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS accounts_phone_idx
  ON public.accounts (phone)
  WHERE phone IS NOT NULL;

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================

COMMENT ON COLUMN public.accounts.email IS
  'Account email address (editable by account owner). Separate from auth.users.email.';

COMMENT ON COLUMN public.accounts.phone IS
  'Account phone number (editable by account owner).';







