-- Reset pins RLS: Remove all existing policies and set up simple, proper, functional RLS
-- This migration drops all existing RLS policies, disables RLS, then re-enables it with clean policies

-- ============================================================================
-- STEP 1: Drop ALL existing RLS policies on pins table
-- ============================================================================

-- Drop all policies (using dynamic SQL to catch any we might miss)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pins'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pins', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Disable RLS
-- ============================================================================

ALTER TABLE public.pins DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Re-enable RLS
-- ============================================================================

ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;

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
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Return false if no authenticated user
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

COMMENT ON FUNCTION public.user_owns_account(UUID) IS 
  'Returns true if the current authenticated user owns the account. Uses SECURITY DEFINER to bypass RLS on accounts table.';

-- ============================================================================
-- STEP 5: Create simple, proper, functional RLS policies
-- ============================================================================

-- SELECT: Public pins visible to everyone, only_me pins visible to owner
-- Users can always see their own pins (including archived ones)
CREATE POLICY "pins_select"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Users can always see their own pins (including archived)
    (
      account_id IS NOT NULL
      AND public.user_owns_account(account_id)
    )
    OR
    -- Public pins (not archived) are visible to everyone
    (visibility = 'public' AND archived = false)
    OR
    -- Only_me pins (not archived) are visible only to their owner
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND public.user_owns_account(account_id)
      AND archived = false
    )
  );

-- INSERT: Authenticated users can insert pins for accounts they own
-- Anonymous users can insert pins for guest accounts (user_id IS NULL)
CREATE POLICY "pins_insert"
  ON public.pins
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      -- Authenticated users: must own the account
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      -- Anonymous users: account must be a guest account (user_id IS NULL)
      (
        auth.uid() IS NULL
        AND EXISTS (
          SELECT 1 FROM public.accounts
          WHERE accounts.id = account_id
          AND accounts.user_id IS NULL
          AND accounts.guest_id IS NOT NULL
        )
      )
    )
  );

-- UPDATE: Authenticated users can update pins for accounts they own
-- Note: WITH CHECK must also verify ownership because it evaluates the new row
CREATE POLICY "pins_update"
  ON public.pins
  FOR UPDATE
  TO authenticated
  USING (
    -- Check old row: user must own the pin
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  )
  WITH CHECK (
    -- Check new row: ensure account_id is not null and user still owns it
    -- Must verify ownership here to prevent account_id changes
    -- Using SECURITY DEFINER function to reliably check ownership even if accounts RLS blocks direct access
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- DELETE: Authenticated users can delete pins for accounts they own
CREATE POLICY "pins_delete"
  ON public.pins
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pins TO authenticated;
GRANT SELECT, INSERT ON public.pins TO anon;

-- ============================================================================
-- STEP 7: Add policy comments
-- ============================================================================

COMMENT ON POLICY "pins_select" ON public.pins IS
  'Public pins (not archived) are visible to everyone. Only_me pins are visible only to their owner.';

COMMENT ON POLICY "pins_insert" ON public.pins IS
  'Authenticated users can insert pins for accounts they own. Anonymous users can insert pins for guest accounts.';

COMMENT ON POLICY "pins_update" ON public.pins IS
  'Authenticated users can update pins for accounts they own.';

COMMENT ON POLICY "pins_delete" ON public.pins IS
  'Authenticated users can delete pins for accounts they own.';
