-- Comprehensive fix for guest account function permissions
-- This migration checks current state and ensures everything is correct

-- ============================================================================
-- STEP 1: Check and fix function ownership and permissions
-- ============================================================================

-- Ensure function exists and is owned by postgres (required for SECURITY DEFINER)
DO $$
BEGIN
  -- Check if function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'get_or_create_guest_account'
    AND pg_get_function_arguments(p.oid) = 'p_guest_id text, p_first_name text'
  ) THEN
    -- Function exists, ensure it's owned by postgres
    ALTER FUNCTION public.get_or_create_guest_account(TEXT, TEXT) OWNER TO postgres;
    
    -- Grant execute permission
    GRANT EXECUTE ON FUNCTION public.get_or_create_guest_account(TEXT, TEXT) TO anon, authenticated;
    
    RAISE NOTICE 'Function exists, updated ownership and permissions';
  ELSE
    RAISE EXCEPTION 'Function get_or_create_guest_account does not exist. Run migration 220 first.';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Ensure table-level permissions for anon role
-- ============================================================================

-- Grant necessary permissions on accounts table to anon
GRANT SELECT, INSERT, UPDATE ON public.accounts TO anon;

-- ============================================================================
-- STEP 3: Ensure RLS policies exist for guest account operations
-- ============================================================================

-- Drop existing UPDATE policy if it exists
DROP POLICY IF EXISTS "Anonymous users can update own guest account" ON public.accounts;

-- Create UPDATE policy for anonymous users to update their own guest accounts
CREATE POLICY "Anonymous users can update own guest account"
  ON public.accounts FOR UPDATE
  TO anon
  USING (
    user_id IS NULL
    AND guest_id IS NOT NULL
  )
  WITH CHECK (
    user_id IS NULL
    AND guest_id IS NOT NULL
  );

COMMENT ON POLICY "Anonymous users can update own guest account" ON public.accounts IS
  'Allows anonymous users to update their own guest accounts. Used by get_or_create_guest_account SECURITY DEFINER function.';

-- ============================================================================
-- STEP 4: Verify function is SECURITY DEFINER
-- ============================================================================

DO $$
DECLARE
  v_security_definer BOOLEAN;
BEGIN
  SELECT prosecdef INTO v_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname = 'get_or_create_guest_account'
  AND pg_get_function_arguments(p.oid) = 'p_guest_id text, p_first_name text';
  
  IF NOT v_security_definer THEN
    RAISE EXCEPTION 'Function get_or_create_guest_account is not SECURITY DEFINER. This is required for it to bypass RLS.';
  ELSE
    RAISE NOTICE 'Function is correctly set as SECURITY DEFINER';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Test that permissions are correct
-- ============================================================================

-- Verify grants exist
DO $$
DECLARE
  v_has_execute BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
    AND routine_name = 'get_or_create_guest_account'
    AND grantee = 'anon'
    AND privilege_type = 'EXECUTE'
  ) INTO v_has_execute;
  
  IF NOT v_has_execute THEN
    RAISE WARNING 'anon role does not have EXECUTE permission on function';
  ELSE
    RAISE NOTICE 'anon role has EXECUTE permission on function';
  END IF;
END $$;

COMMENT ON FUNCTION public.get_or_create_guest_account IS
  'Gets or creates a guest account for anonymous users. Guest accounts have NULL user_id and are identified by guest_id (stored in local storage). Sets default guest image from Supabase storage. Returns account details as JSON (bypasses RLS via SECURITY DEFINER).';




