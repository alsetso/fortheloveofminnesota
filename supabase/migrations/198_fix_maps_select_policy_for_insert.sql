-- Fix maps RLS: Add simpler SELECT policy for INSERT compatibility
-- The issue: When INSERTing, PostgreSQL checks if you can SELECT the new row
-- The current SELECT policy uses user_has_map_access which queries maps table
-- This creates a circular dependency during INSERT
-- Solution: Add a simpler policy that checks account_id ownership directly

-- ============================================================================
-- STEP 1: Drop existing SELECT policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can view accessible maps" ON public.maps;

-- ============================================================================
-- STEP 2: Create simpler SELECT policy that works with INSERT
-- ============================================================================

-- Policy: Users can view maps they own (by account_id) or that are shared with them
-- This policy allows INSERT to succeed because it checks account_id directly
-- rather than querying the maps table through a function
CREATE POLICY "Users can view accessible maps"
  ON public.maps
  FOR SELECT
  TO authenticated
  USING (
    -- User owns the map (check account_id directly)
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = maps.account_id
      AND accounts.user_id = auth.uid()
    )
    OR
    -- OR map is shared with user (use function for this check)
    public.user_has_map_access(maps.id, 'view'::public.map_permission)
  );

-- ============================================================================
-- STEP 3: Ensure user_owns_account function is correct
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
-- STEP 4: Ensure INSERT policy is correct
-- ============================================================================

DROP POLICY IF EXISTS "Users can create maps" ON public.maps;

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




