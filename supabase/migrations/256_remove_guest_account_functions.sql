-- Remove all guest account functions and policies
-- Guest accounts are no longer supported - users must have real accounts

-- ============================================================================
-- STEP 1: Drop all policies that depend on guest account functions
-- ============================================================================

-- Drop pins policies that use anon_owns_guest_account()
DROP POLICY IF EXISTS "Public read access for pins" ON public.pins;
DROP POLICY IF EXISTS "Users and guests can insert pins" ON public.pins;
DROP POLICY IF EXISTS "Users and guests can update own pins" ON public.pins;
DROP POLICY IF EXISTS "Users and guests can delete own pins" ON public.pins;

-- Drop accounts policies that use get_request_guest_id()
DROP POLICY IF EXISTS "Anonymous users can view own guest account" ON public.accounts;
DROP POLICY IF EXISTS "Anonymous users can update own guest account" ON public.accounts;

-- ============================================================================
-- STEP 2: Recreate pins policies without guest account support
-- ============================================================================

-- SELECT policy: Only authenticated users can see private pins
CREATE POLICY "Public read access for pins"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public pins visible to everyone
    visibility = 'public'
    OR
    -- Private pins: authenticated users who own the account
    (
      visibility = 'only_me'
      AND account_id IS NOT NULL
      AND auth.uid() IS NOT NULL
      AND public.user_owns_account(account_id)
    )
  );

COMMENT ON POLICY "Public read access for pins" ON public.pins IS
  'Public pins visible to all. Private pins (only_me) visible only to authenticated users who own the account.';

-- INSERT policy: Only authenticated users can create pins
CREATE POLICY "Users can insert pins"
  ON public.pins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND public.user_owns_account(account_id)
  );

COMMENT ON POLICY "Users can insert pins" ON public.pins IS
  'Authenticated users can insert pins only for accounts they own.';

-- UPDATE policy: Only authenticated users can update pins
CREATE POLICY "Users can update own pins"
  ON public.pins
  FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND public.user_owns_account(account_id)
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND public.user_owns_account(account_id)
  );

COMMENT ON POLICY "Users can update own pins" ON public.pins IS
  'Authenticated users can update pins only for accounts they own.';

-- DELETE policy: Only authenticated users can delete pins
CREATE POLICY "Users can delete own pins"
  ON public.pins
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND public.user_owns_account(account_id)
  );

COMMENT ON POLICY "Users can delete own pins" ON public.pins IS
  'Authenticated users can delete pins only for accounts they own.';

-- ============================================================================
-- STEP 3: Drop all guest account related functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.anon_owns_guest_account(UUID);
DROP FUNCTION IF EXISTS public.get_or_create_guest_account(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.generate_guest_username(TEXT);
DROP FUNCTION IF EXISTS public.merge_guest_account_to_user(UUID, TEXT);
DROP FUNCTION IF EXISTS public.delete_all_guest_pins(TEXT);
DROP FUNCTION IF EXISTS public.delete_guest_account(TEXT);
DROP FUNCTION IF EXISTS public.reset_guest_account(TEXT);
DROP FUNCTION IF EXISTS public.get_request_guest_id();

-- ============================================================================
-- NOTES
-- ============================================================================

-- Note: We keep the guest_id column in accounts table for existing data
-- compatibility, but new guest accounts will not be created.
-- 
-- All RLS policies now require authentication - anonymous users can only
-- view public pins and public account information.

