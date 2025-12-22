-- Comprehensive fix for maps INSERT RLS policy
-- Ensures user_owns_account function exists and is properly configured
-- Then fixes the INSERT policy to match the working posts table pattern

-- ============================================================================
-- STEP 1: Ensure user_owns_account function exists and is correct
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_owns_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Return false if no authenticated user
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_owns_account(UUID) TO authenticated, anon;

-- ============================================================================
-- STEP 2: Drop existing maps INSERT policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can create maps" ON public.maps;

-- ============================================================================
-- STEP 3: Recreate INSERT policy matching the working posts table pattern
-- ============================================================================

-- Policy: Users can create maps
-- Matches the exact pattern from posts_insert policy (migration 146)
CREATE POLICY "Users can create maps"
  ON public.maps
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    -- Must own the account (uses SECURITY DEFINER function)
    AND public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 4: Verify grants are in place
-- ============================================================================

-- Ensure INSERT permission is granted (should already exist, but ensure it)
GRANT INSERT ON public.maps TO authenticated;




