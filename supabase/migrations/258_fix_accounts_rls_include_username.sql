-- Fix accounts RLS to include username for anonymous users viewing accounts with public pins
-- Migration 217 created the policy but didn't grant username column access

-- ============================================================================
-- STEP 1: Ensure column-level GRANT includes username
-- ============================================================================

-- Revoke all SELECT permissions first (to reset)
REVOKE SELECT ON public.accounts FROM anon;

-- Grant only safe columns to anonymous users (including username for display)
GRANT SELECT (id, first_name, last_name, username, image_url) ON public.accounts TO anon;

-- ============================================================================
-- STEP 2: Verify the policy exists (it should from migration 217)
-- ============================================================================

-- Policy should already exist from migration 217
-- If it doesn't, create it
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
        )
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add comment explaining the fix
-- ============================================================================

COMMENT ON POLICY "Anonymous users can view accounts with public pins" ON public.accounts IS 
  'Allows anonymous users to view safe columns (id, first_name, last_name, username, image_url) for accounts that have public pins. Column-level GRANT ensures sensitive fields are never exposed. This enables displaying pin creator information (username and image) in map popups and feeds securely.';

