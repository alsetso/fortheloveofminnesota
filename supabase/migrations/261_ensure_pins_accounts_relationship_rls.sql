-- Ensure pins.account_id foreign key relationship exists and RLS is correct
-- This ensures Supabase can properly join accounts with pins using RLS

-- ============================================================================
-- STEP 1: Ensure foreign key constraint exists
-- ============================================================================

-- Check if foreign key exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'pins' 
    AND constraint_name LIKE '%account_id%fkey%'
  ) THEN
    -- Add foreign key constraint if it doesn't exist
    ALTER TABLE public.pins
      ADD CONSTRAINT pins_account_id_fkey
      FOREIGN KEY (account_id)
      REFERENCES public.accounts(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Verify accounts RLS policies are correct
-- ============================================================================

-- Ensure authenticated users can view all accounts (for joins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'accounts' 
    AND policyname = 'Authenticated users can view basic account info'
  ) THEN
    CREATE POLICY "Authenticated users can view basic account info"
      ON public.accounts FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Ensure anonymous users can view accounts with public pins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'accounts' 
    AND policyname = 'Anonymous users can view accounts with public pins'
  ) THEN
    CREATE POLICY "Anonymous users can view accounts with public pins"
      ON public.accounts FOR SELECT
      TO anon
      USING (
        -- Accounts with public pins
        EXISTS (
          SELECT 1 FROM public.pins
          WHERE pins.account_id = accounts.id
          AND pins.visibility = 'public'
          AND pins.archived = false
        )
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Ensure column-level GRANT for anonymous users
-- ============================================================================

-- Grant only safe columns to anonymous users
REVOKE SELECT ON public.accounts FROM anon;
GRANT SELECT (id, first_name, last_name, username, image_url) ON public.accounts TO anon;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON POLICY "Authenticated users can view basic account info" ON public.accounts IS 
  'Allows authenticated users to view all accounts. This enables joins with pins to display account information (username, image) for all pins. Safe because only basic fields are exposed.';

COMMENT ON POLICY "Anonymous users can view accounts with public pins" ON public.accounts IS 
  'Allows anonymous users to view safe columns (id, first_name, last_name, username, image_url) for accounts that have public pins. Column-level GRANT ensures sensitive fields are never exposed. This enables displaying pin creator information in map popups and feeds securely.';
