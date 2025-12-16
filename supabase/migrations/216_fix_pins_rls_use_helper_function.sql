-- Fix pins RLS policy to use helper function for anonymous user compatibility
-- The current policy directly queries accounts table which may fail for anonymous users
-- This migration updates the SELECT policy to use user_owns_account() helper function

-- ============================================================================
-- STEP 1: Ensure user_owns_account helper function exists and is correct
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_owns_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Return false immediately if no authenticated user (handles anonymous users)
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- SECURITY DEFINER runs with postgres privileges, bypassing RLS
  -- This allows us to check account ownership even if accounts table has RLS
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = account_id
    AND accounts.user_id = auth.uid()
  );
END;
$$;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.user_owns_account(UUID) OWNER TO postgres;

-- Grant execute permission to both authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.user_owns_account(UUID) TO authenticated, anon;

-- ============================================================================
-- STEP 2: Update SELECT policy to use helper function
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Public read access for pins" ON public.pins;

-- Recreate policy using helper function
-- This fixes issues where anonymous users get errors when querying pins
-- because the direct accounts table query may be blocked by accounts RLS
CREATE POLICY "Public read access for pins"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public pins are visible to everyone
    visibility = 'public'
    OR
    -- Private pins (only_me) are only visible to their creator
    -- Use helper function which handles NULL auth.uid() gracefully
    -- and bypasses RLS on accounts table via SECURITY DEFINER
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND public.user_owns_account(account_id)
    )
  );

-- ============================================================================
-- STEP 3: Add index for visibility filtering (performance optimization)
-- ============================================================================

-- Index helps PostgreSQL quickly filter public pins without checking ownership
CREATE INDEX IF NOT EXISTS idx_pins_visibility_account_id 
  ON public.pins(visibility, account_id) 
  WHERE visibility IN ('public', 'only_me');

-- ============================================================================
-- STEP 4: Add comment explaining the policy
-- ============================================================================

COMMENT ON POLICY "Public read access for pins" ON public.pins IS
  'Allows anyone (authenticated or anonymous) to view public pins. Private pins (only_me) are only visible to their creator. Uses user_owns_account() helper function which bypasses RLS on accounts table and handles anonymous users gracefully.';

