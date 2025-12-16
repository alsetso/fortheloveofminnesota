-- Add 'renter' and 'businessowner' to account_trait enum
-- Extends the available traits users can select

-- ============================================================================
-- STEP 1: Create new enum type with additional values
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_trait_new') THEN
    CREATE TYPE public.account_trait_new AS ENUM (
      'homeowner',
      'buyer',
      'investor',
      'realtor',
      'wholesaler',
      'lender',
      'title',
      'renter',
      'businessowner'
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Migrate data to new enum type
-- ============================================================================

-- Drop the index temporarily
DROP INDEX IF EXISTS public.accounts_traits_idx;

-- Add temporary column with new enum type
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS traits_new public.account_trait_new[] DEFAULT '{}';

-- Convert and migrate data
DO $$
DECLARE
  account_record RECORD;
  old_trait public.account_trait;
  new_traits public.account_trait_new[];
  trait_text text;
BEGIN
  FOR account_record IN SELECT id, traits FROM public.accounts WHERE traits IS NOT NULL AND array_length(traits, 1) > 0
  LOOP
    new_traits := '{}'::public.account_trait_new[];
    
    FOREACH old_trait IN ARRAY account_record.traits
    LOOP
      trait_text := old_trait::text;
      
      -- Map all existing traits to new enum
      IF trait_text IN ('homeowner', 'buyer', 'investor', 'realtor', 'wholesaler', 'lender', 'title') THEN
        BEGIN
          new_traits := array_append(new_traits, trait_text::public.account_trait_new);
        EXCEPTION WHEN OTHERS THEN
          -- Skip invalid enum values
          NULL;
        END;
      END IF;
    END LOOP;
    
    UPDATE public.accounts
    SET traits_new = new_traits
    WHERE id = account_record.id;
  END LOOP;
END $$;

-- Drop old column
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS traits;

-- Rename new column to original name
ALTER TABLE public.accounts
  RENAME COLUMN traits_new TO traits;

-- ============================================================================
-- STEP 3: Drop old enum and rename new enum
-- ============================================================================

-- Drop old enum type
DROP TYPE IF EXISTS public.account_trait CASCADE;

-- Rename new enum to original name
ALTER TYPE public.account_trait_new RENAME TO account_trait;

-- ============================================================================
-- STEP 4: Recreate index and update comments
-- ============================================================================

-- Recreate the index
CREATE INDEX IF NOT EXISTS accounts_traits_idx
  ON public.accounts USING GIN (traits)
  WHERE traits IS NOT NULL AND array_length(traits, 1) > 0;

-- Update comments
COMMENT ON TYPE public.account_trait IS
  'Enum type for account traits that define user activities on MNUDA. Users can have multiple traits.';

COMMENT ON COLUMN public.accounts.traits IS
  'Array of account traits that help define the account''s activities on MNUDA. Users can select multiple traits from: homeowner, buyer, investor, realtor, wholesaler, lender, title, renter, businessowner.';




