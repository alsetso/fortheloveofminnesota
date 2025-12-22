-- Fix pin_collections RLS policies to allow guest accounts to create collections
-- Guest accounts have user_id IS NULL and guest_id IS NOT NULL
-- Similar pattern to pins RLS (migration 218)

-- ============================================================================
-- STEP 1: Ensure visibility column exists (may have been missed due to migration conflict)
-- ============================================================================

ALTER TABLE public.pin_collections
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
CHECK (visibility IN ('public', 'private'));

CREATE INDEX IF NOT EXISTS idx_pin_collections_visibility 
ON public.pin_collections(visibility);

-- ============================================================================
-- STEP 2: Grant permissions on pin_collections to anon role
-- ============================================================================

GRANT INSERT, UPDATE, DELETE ON public.pin_collections TO anon;

-- ============================================================================
-- STEP 3: Update INSERT policy to allow guests
-- ============================================================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own pin_collections" ON public.pin_collections;

-- Create policy that allows both authenticated users and anonymous guests
CREATE POLICY "Users and guests can insert pin_collections"
  ON public.pin_collections
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      -- Authenticated users: must own the account
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      -- Anonymous guests: account must be a guest account (user_id IS NULL)
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

COMMENT ON POLICY "Users and guests can insert pin_collections" ON public.pin_collections IS
  'Allows authenticated users to create collections for their own account, and guest users to create collections for their guest account.';

-- ============================================================================
-- STEP 4: Update UPDATE policy to allow guests
-- ============================================================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own pin_collections" ON public.pin_collections;

-- Create policy that allows both authenticated users and anonymous guests
CREATE POLICY "Users and guests can update pin_collections"
  ON public.pin_collections
  FOR UPDATE
  TO authenticated, anon
  USING (
    account_id IS NOT NULL
    AND (
      -- Authenticated users: must own the account
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      -- Anonymous guests: account must be a guest account
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
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      -- Authenticated users: must own the account
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      -- Anonymous guests: account must be a guest account
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

COMMENT ON POLICY "Users and guests can update pin_collections" ON public.pin_collections IS
  'Allows authenticated users to update their own collections, and guest users to update collections for their guest account.';

-- ============================================================================
-- STEP 5: Update DELETE policy to allow guests
-- ============================================================================

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Users can delete own pin_collections" ON public.pin_collections;

-- Create policy that allows both authenticated users and anonymous guests
CREATE POLICY "Users and guests can delete pin_collections"
  ON public.pin_collections
  FOR DELETE
  TO authenticated, anon
  USING (
    account_id IS NOT NULL
    AND (
      -- Authenticated users: must own the account
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      -- Anonymous guests: account must be a guest account
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

COMMENT ON POLICY "Users and guests can delete pin_collections" ON public.pin_collections IS
  'Allows authenticated users to delete their own collections, and guest users to delete collections for their guest account.';

-- ============================================================================
-- STEP 6: Update SELECT policy to allow guests to see their own private collections
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Read own or public collections" ON public.pin_collections;

-- Create policy that allows guests to see their own collections
CREATE POLICY "Read own or public collections"
  ON public.pin_collections
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public collections visible to everyone
    visibility = 'public'
    OR (
      -- Own collections (authenticated users)
      account_id IS NOT NULL 
      AND auth.uid() IS NOT NULL
      AND public.user_owns_account(account_id)
    )
    OR (
      -- Own collections (guest users) - guests can see all their collections
      account_id IS NOT NULL
      AND auth.uid() IS NULL
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = account_id
        AND accounts.user_id IS NULL
        AND accounts.guest_id IS NOT NULL
      )
    )
  );

COMMENT ON POLICY "Read own or public collections" ON public.pin_collections IS
  'Allows anyone to read public collections. Private collections are only visible to their owner (authenticated or guest).';

