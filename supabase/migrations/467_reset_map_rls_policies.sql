-- Reset RLS policies on map table
-- Drops all existing policies and recreates them with simpler, more permissive rules

-- ============================================================================
-- STEP 1: Drop all existing RLS policies on map table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view accessible maps" ON public.map;
DROP POLICY IF EXISTS "Users can create maps" ON public.map;
DROP POLICY IF EXISTS "Users can update own maps" ON public.map;
DROP POLICY IF EXISTS "Users can update accessible maps" ON public.map;
DROP POLICY IF EXISTS "Users can delete own maps" ON public.map;

-- ============================================================================
-- STEP 2: Temporarily disable RLS (for testing/debugging)
-- ============================================================================

-- ALTER TABLE public.map DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Re-enable RLS
-- ============================================================================

ALTER TABLE public.map ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Ensure user_owns_account function exists and is correct
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_owns_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  account_exists BOOLEAN;
BEGIN
  -- Get current user ID first
  current_user_id := auth.uid();
  
  -- Return false immediately if no authenticated user
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Return false if account_id is null
  IF account_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- SECURITY DEFINER runs with postgres privileges, bypassing RLS
  -- This allows us to check account ownership even if accounts table has RLS
  SELECT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = account_id
    AND accounts.user_id = current_user_id
  ) INTO account_exists;
  
  RETURN COALESCE(account_exists, FALSE);
END;
$$;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.user_owns_account(UUID) OWNER TO postgres;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_owns_account(UUID) TO authenticated, anon;

-- ============================================================================
-- STEP 5: Create simplified RLS policies
-- ============================================================================

-- Policy: Users can view maps they own or that are public
CREATE POLICY "map_select_policy"
  ON public.map
  FOR SELECT
  TO authenticated, anon
  USING (
    visibility = 'public'
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = map.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

-- Policy: Authenticated users can create maps
-- Simplified to check auth.uid() directly instead of using helper function
CREATE POLICY "map_insert_policy"
  ON public.map
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Policy: Users can update maps they own
CREATE POLICY "map_update_policy"
  ON public.map
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = map.account_id
      AND accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = map.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Policy: Users can delete maps they own
CREATE POLICY "map_delete_policy"
  ON public.map
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = map.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Verify policies were created
-- ============================================================================

-- List all policies on map table for verification
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE 'RLS policies on map table:';
  FOR policy_record IN
    SELECT policyname, cmd, roles
    FROM pg_policies
    WHERE tablename = 'map' AND schemaname = 'public'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  Policy: %, Command: %, Roles: %', 
      policy_record.policyname, 
      policy_record.cmd, 
      policy_record.roles;
  END LOOP;
END $$;
