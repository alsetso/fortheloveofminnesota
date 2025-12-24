-- Secure guest pins RLS policies
-- Fixes security holes in guest account pin management:
-- 1. Guest INSERT was overly permissive (any anon could post to any guest account)
-- 2. Guests couldn't see their own private pins via RLS
-- 3. Adds proper guest_id verification using request header

-- ============================================================================
-- STEP 1: Create helper function to get guest_id from request header
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_request_guest_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Gets x-guest-id header set by the client
  -- Supabase stores headers as JSON in request.headers setting
  -- Returns NULL if not set or empty
  SELECT NULLIF(
    COALESCE(
      (current_setting('request.headers', true)::json)->>'x-guest-id',
      ''
    ),
    ''
  );
$$;

ALTER FUNCTION public.get_request_guest_id() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_request_guest_id() TO authenticated, anon;

COMMENT ON FUNCTION public.get_request_guest_id() IS
  'Gets the x-guest-id header from the current request. Used by RLS policies to verify guest account ownership.';

-- ============================================================================
-- STEP 2: Create helper function to check if anon user owns a guest account
-- ============================================================================

CREATE OR REPLACE FUNCTION public.anon_owns_guest_account(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id TEXT;
  v_request_guest_id TEXT;
BEGIN
  -- Only for anonymous users
  IF auth.uid() IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- Get guest_id from request header
  v_request_guest_id := public.get_request_guest_id();
  IF v_request_guest_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if account exists, is a guest account, and guest_id matches
  SELECT guest_id INTO v_guest_id
  FROM public.accounts
  WHERE id = p_account_id
    AND user_id IS NULL
    AND guest_id IS NOT NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN v_guest_id = v_request_guest_id;
END;
$$;

ALTER FUNCTION public.anon_owns_guest_account(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.anon_owns_guest_account(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.anon_owns_guest_account(UUID) IS
  'Checks if the current anonymous user owns a guest account by comparing x-guest-id header with account.guest_id. Returns FALSE for authenticated users.';

-- ============================================================================
-- STEP 3: Update pins SELECT policy to allow guests to see their private pins
-- ============================================================================

DROP POLICY IF EXISTS "Public read access for pins" ON public.pins;

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
    OR
    -- Private pins: anonymous users who own the guest account
    (
      visibility = 'only_me'
      AND account_id IS NOT NULL
      AND auth.uid() IS NULL
      AND public.anon_owns_guest_account(account_id)
    )
  );

COMMENT ON POLICY "Public read access for pins" ON public.pins IS
  'Public pins visible to all. Private pins (only_me) visible only to owner - authenticated users via user_owns_account(), guests via anon_owns_guest_account() which verifies x-guest-id header.';

-- ============================================================================
-- STEP 4: Update pins INSERT policy to verify guest ownership
-- ============================================================================

DROP POLICY IF EXISTS "Users and guests can insert pins" ON public.pins;

CREATE POLICY "Users and guests can insert pins"
  ON public.pins
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      -- Authenticated users: must own the account
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      -- Anonymous guests: must own the guest account (verified via x-guest-id header)
      (auth.uid() IS NULL AND public.anon_owns_guest_account(account_id))
    )
  );

COMMENT ON POLICY "Users and guests can insert pins" ON public.pins IS
  'Authenticated users can insert pins for accounts they own. Guests can insert pins only for their own guest account (verified via x-guest-id header matching account.guest_id).';

-- ============================================================================
-- STEP 5: Update pins UPDATE policy (if exists) for guest support
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own pins" ON public.pins;

CREATE POLICY "Users and guests can update own pins"
  ON public.pins
  FOR UPDATE
  TO authenticated, anon
  USING (
    account_id IS NOT NULL
    AND (
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      (auth.uid() IS NULL AND public.anon_owns_guest_account(account_id))
    )
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      (auth.uid() IS NULL AND public.anon_owns_guest_account(account_id))
    )
  );

COMMENT ON POLICY "Users and guests can update own pins" ON public.pins IS
  'Users can update pins for accounts they own. Guests can update pins for their own guest account (verified via x-guest-id header).';

-- ============================================================================
-- STEP 6: Update pins DELETE policy for guest support
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete own pins" ON public.pins;

CREATE POLICY "Users and guests can delete own pins"
  ON public.pins
  FOR DELETE
  TO authenticated, anon
  USING (
    account_id IS NOT NULL
    AND (
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      (auth.uid() IS NULL AND public.anon_owns_guest_account(account_id))
    )
  );

COMMENT ON POLICY "Users and guests can delete own pins" ON public.pins IS
  'Users can delete pins for accounts they own. Guests can delete pins for their own guest account (verified via x-guest-id header).';

-- ============================================================================
-- STEP 7: Update accounts SELECT policy for guests viewing own account
-- ============================================================================

DROP POLICY IF EXISTS "Anonymous users can view own guest account" ON public.accounts;

CREATE POLICY "Anonymous users can view own guest account"
  ON public.accounts
  FOR SELECT
  TO anon
  USING (
    user_id IS NULL
    AND guest_id IS NOT NULL
    AND guest_id = public.get_request_guest_id()
  );

COMMENT ON POLICY "Anonymous users can view own guest account" ON public.accounts IS
  'Allows anonymous users to view their own guest account by verifying x-guest-id header matches account.guest_id.';

-- ============================================================================
-- STEP 8: Add index for guest_id lookups in RLS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_guest_id_for_rls
  ON public.accounts(guest_id)
  WHERE guest_id IS NOT NULL AND user_id IS NULL;

-- ============================================================================
-- USAGE NOTES
-- ============================================================================

-- Client-side: When making Supabase requests as a guest, set the x-guest-id header:
--
-- const guestId = localStorage.getItem('guest_id');
-- const { data, error } = await supabase
--   .from('pins')
--   .select('*')
--   .headers({ 'x-guest-id': guestId });
--
-- Or configure globally in Supabase client:
--
-- const supabase = createClient(url, key, {
--   global: {
--     headers: () => {
--       const guestId = localStorage.getItem('guest_id');
--       return guestId ? { 'x-guest-id': guestId } : {};
--     }
--   }
-- });



