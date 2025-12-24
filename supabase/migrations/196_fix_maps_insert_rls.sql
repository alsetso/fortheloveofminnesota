-- Fix maps INSERT RLS policy
-- The policy needs explicit auth.uid() check and proper account ownership verification

-- ============================================================================
-- STEP 1: Drop existing policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can create maps" ON public.maps;

-- ============================================================================
-- STEP 2: Recreate policy with explicit checks
-- ============================================================================

-- Policy: Users can create maps
-- Uses SECURITY DEFINER function to bypass accounts table RLS
CREATE POLICY "Users can create maps"
  ON public.maps
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    -- Must own the account (uses SECURITY DEFINER function)
    AND account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );






