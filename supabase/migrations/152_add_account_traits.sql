-- Add account_trait enum and traits array column to accounts table
-- Allows users to select multiple traits that define their activities

-- ============================================================================
-- STEP 1: Create account_trait enum type
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_trait') THEN
    CREATE TYPE public.account_trait AS ENUM (
      'resident',
      'homeowner',
      'buyer',
      'wholesaler',
      'investor',
      'realtor',
      'broker',
      'contractor',
      'services',
      'business',
      'lender',
      'landlord',
      'manager',
      'developer'
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add traits column to accounts table
-- ============================================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS traits public.account_trait[] DEFAULT '{}';

-- ============================================================================
-- STEP 3: Create GIN index for efficient array searches
-- ============================================================================

CREATE INDEX IF NOT EXISTS accounts_traits_idx
  ON public.accounts USING GIN (traits)
  WHERE traits IS NOT NULL AND array_length(traits, 1) > 0;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON TYPE public.account_trait IS
  'Enum type for account traits that define user activities. Users can have multiple traits.';

COMMENT ON COLUMN public.accounts.traits IS
  'Array of account traits that help define the account''s activities. Users can select multiple traits from: resident, homeowner, buyer, wholesaler, investor, realtor, broker, contractor, services, business, lender, landlord, manager, developer.';


