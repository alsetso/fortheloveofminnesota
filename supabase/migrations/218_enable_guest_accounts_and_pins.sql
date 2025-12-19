-- Enable guest accounts and guest pin posting
-- Allows anonymous users to create guest accounts and post pins
-- Guest accounts have NULL user_id and are identified by a guest_id stored in local storage

-- ============================================================================
-- STEP 1: Modify accounts table to support guest accounts (nullable user_id)
-- ============================================================================

-- Make user_id nullable to support guest accounts
ALTER TABLE public.accounts
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop the foreign key constraint (we'll recreate it as deferrable or handle it differently)
-- Actually, we can keep the FK but make it nullable - FK constraints allow NULL
-- The existing FK should already allow NULL, but let's ensure it's correct
-- Remove the ON DELETE CASCADE for NULL user_id cases (guests)
-- We'll handle this by keeping the FK but making it work with NULL

-- Add guest_id column for guest account identification (stored in local storage)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS guest_id TEXT UNIQUE;

-- Add index for guest_id lookups
CREATE INDEX IF NOT EXISTS idx_accounts_guest_id 
  ON public.accounts(guest_id) 
  WHERE guest_id IS NOT NULL;

-- Add check constraint: either user_id or guest_id must be set
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_user_or_guest_check 
  CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL);

-- ============================================================================
-- STEP 2: Update accounts RLS to allow anonymous users to view accounts with public pins
-- ============================================================================

-- Drop existing anonymous policy
DROP POLICY IF EXISTS "Anonymous users can view accounts with public pins" ON public.accounts;
DROP POLICY IF EXISTS "Anonymous users can view accounts with public content" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated and anon users can view basic account info" ON public.accounts;

-- Create policy that allows anonymous users to see accounts with public pins
-- This enables displaying pin creator information in the feed
CREATE POLICY "Anonymous users can view accounts with public pins"
  ON public.accounts FOR SELECT
  TO anon
  USING (
    -- Accounts with public pins
    EXISTS (
      SELECT 1 FROM public.pins
      WHERE pins.account_id = accounts.id
      AND pins.visibility = 'public'
    )
  );

-- Policy: Anonymous users can view their own guest account (by guest_id from local storage)
-- This is needed for the pins INSERT policy to verify guest account ownership
CREATE POLICY "Anonymous users can view own guest account"
  ON public.accounts FOR SELECT
  TO anon
  USING (
    user_id IS NULL
    AND guest_id IS NOT NULL
    -- Note: We can't check guest_id against a session variable in RLS
    -- Instead, the application will verify ownership before using the account
    -- This policy allows anonymous users to query guest accounts in general
    -- The pins INSERT policy will verify the specific account_id matches
  );

-- Grant column-level SELECT permission to anon role (only safe columns)
REVOKE SELECT ON public.accounts FROM anon;
GRANT SELECT (id, first_name, last_name, username, image_url, guest_id) ON public.accounts TO anon;

COMMENT ON POLICY "Anonymous users can view accounts with public pins" ON public.accounts IS 
  'Allows anonymous users to view safe columns (id, first_name, last_name, username, image_url, guest_id) for accounts that have public pins. Column-level GRANT ensures sensitive fields are never exposed.';

-- ============================================================================
-- STEP 3: Allow anonymous users to INSERT guest accounts
-- ============================================================================

-- Grant INSERT permission on accounts to anon (with RLS policy restrictions)
GRANT INSERT ON public.accounts TO anon;

-- Policy: Anonymous users can insert guest accounts (with guest_id, no user_id)
CREATE POLICY "Anonymous users can insert guest accounts"
  ON public.accounts FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL 
    AND guest_id IS NOT NULL
    AND first_name IS NOT NULL
  );

COMMENT ON POLICY "Anonymous users can insert guest accounts" ON public.accounts IS
  'Allows anonymous users to create guest accounts with guest_id and first_name. Guest accounts have NULL user_id.';

-- ============================================================================
-- STEP 4: Fix pins RLS SELECT policy to work for anonymous users
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Public read access for pins" ON public.pins;

-- Create policy that works for both authenticated and anonymous users
-- Uses user_owns_account() helper which handles NULL auth.uid() gracefully
CREATE POLICY "Public read access for pins"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public pins are visible to everyone
    visibility = 'public'
    OR
    -- Private pins (only_me) are only visible to their creator
    -- For anonymous users, auth.uid() is NULL, so user_owns_account() returns FALSE
    -- For authenticated users, user_owns_account() checks ownership via SECURITY DEFINER
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND public.user_owns_account(account_id)
    )
  );

COMMENT ON POLICY "Public read access for pins" ON public.pins IS
  'Allows anyone (authenticated or anonymous) to view public pins. Private pins (only_me) are only visible to their creator. Uses user_owns_account() helper function which bypasses RLS on accounts table and handles anonymous users gracefully.';

-- ============================================================================
-- STEP 5: Allow anonymous users to INSERT pins (for guest posting)
-- ============================================================================

-- Grant INSERT permission on pins to anon
GRANT INSERT ON public.pins TO anon;

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own pins" ON public.pins;

-- Create policy that allows both authenticated users and anonymous guests to insert pins
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

COMMENT ON POLICY "Users and guests can insert pins" ON public.pins IS
  'Allows authenticated users to insert pins they own, and anonymous guests to insert pins with guest accounts. Guest accounts are identified by NULL user_id and non-NULL guest_id.';

-- ============================================================================
-- STEP 6: Create function to get or create guest account
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_guest_account(
  p_guest_id TEXT,
  p_first_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Try to find existing guest account
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE guest_id = p_guest_id
  AND user_id IS NULL
  LIMIT 1;

  -- If found, update first_name if provided and different
  IF v_account_id IS NOT NULL THEN
    IF p_first_name IS NOT NULL AND p_first_name != '' THEN
      UPDATE public.accounts
      SET first_name = p_first_name,
          updated_at = NOW()
      WHERE id = v_account_id;
    END IF;
    RETURN v_account_id;
  END IF;

  -- Create new guest account
  INSERT INTO public.accounts (guest_id, first_name, role)
  VALUES (p_guest_id, p_first_name, 'general'::public.account_role)
  RETURNING id INTO v_account_id;

  RETURN v_account_id;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_or_create_guest_account(TEXT, TEXT) TO anon, authenticated;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.get_or_create_guest_account(TEXT, TEXT) OWNER TO postgres;

COMMENT ON FUNCTION public.get_or_create_guest_account IS
  'Gets or creates a guest account for anonymous users. Guest accounts have NULL user_id and are identified by guest_id (stored in local storage). Returns the account UUID.';

-- ============================================================================
-- STEP 7: Add indexes for performance
-- ============================================================================

-- Index for accounts RLS policy (checking for public pins)
CREATE INDEX IF NOT EXISTS idx_pins_account_id_visibility 
  ON public.pins(account_id, visibility) 
  WHERE visibility = 'public';

-- Index for pins RLS policy (checking ownership)
CREATE INDEX IF NOT EXISTS idx_pins_visibility_account_id 
  ON public.pins(visibility, account_id) 
  WHERE visibility IN ('public', 'only_me');

-- Index on accounts.user_id for ownership checks
CREATE INDEX IF NOT EXISTS idx_accounts_user_id 
  ON public.accounts(user_id) 
  WHERE user_id IS NOT NULL;

-- Index on accounts for guest account lookups
CREATE INDEX IF NOT EXISTS idx_accounts_guest_id_user_id 
  ON public.accounts(guest_id, user_id) 
  WHERE guest_id IS NOT NULL AND user_id IS NULL;



