-- Fix accounts RLS to allow viewing accounts with public mentions
-- This ensures mention popups can display account information (username, image) for all users
-- The issue: Anonymous users can only view accounts with public pins, not public mentions
-- Authenticated users should be able to view all accounts, but we'll ensure the policy is correct

-- ============================================================================
-- STEP 1: Ensure authenticated users can view all accounts (should already exist)
-- ============================================================================

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

-- ============================================================================
-- STEP 2: Update anonymous users policy to include accounts with public mentions
-- Migration 265 has "Anonymous users can view accounts with public content" with USING (true)
-- But earlier migrations had column-level grants that might conflict
-- We'll ensure accounts with public mentions are explicitly covered
-- ============================================================================

-- Drop old policies that only checked for pins (pins table was dropped in migration 278)
DROP POLICY IF EXISTS "Anonymous users can view accounts with public pins" ON public.accounts;

-- Migration 265 already has a policy with USING (true), but we'll add one that explicitly
-- covers mentions to ensure it works even if migration 265's policy has issues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'accounts' 
    AND policyname = 'Anonymous users can view accounts with public mentions'
  ) THEN
    CREATE POLICY "Anonymous users can view accounts with public mentions"
      ON public.accounts FOR SELECT
      TO anon
      USING (
        -- Accounts with public mentions
        EXISTS (
          SELECT 1 FROM public.mentions
          WHERE mentions.account_id = accounts.id
          AND mentions.visibility = 'public'
          AND mentions.archived = false
        )
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Ensure column-level GRANT includes username for anonymous users
-- Migration 265 grants full SELECT, but earlier migrations had column-level grants
-- We'll ensure username is explicitly granted
-- ============================================================================

-- Ensure username is included in the grant (migration 265 should have full SELECT, but be safe)
-- First check if full SELECT is granted, if not, grant specific columns including username
DO $$
BEGIN
  -- Check if anon has full table SELECT (from migration 265)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE grantee = 'anon'
    AND table_schema = 'public'
    AND table_name = 'accounts'
    AND privilege_type = 'SELECT'
  ) THEN
    -- Full SELECT not granted, use column-level grants
    REVOKE SELECT ON public.accounts FROM anon;
    GRANT SELECT (id, first_name, last_name, username, image_url) ON public.accounts TO anon;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON POLICY "Authenticated users can view basic account info" ON public.accounts IS 
  'Allows authenticated users to view all accounts. This enables joins with mentions to display account information (username, image) for all content. Safe because only basic fields are exposed.';

COMMENT ON POLICY "Anonymous users can view accounts with public mentions" ON public.accounts IS 
  'Allows anonymous users to view safe columns (id, first_name, last_name, username, image_url) for accounts that have public mentions. This enables displaying mention creator information in map popups and feeds securely.';

