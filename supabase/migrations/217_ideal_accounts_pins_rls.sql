-- Ideal RLS setup: Allow anonymous users to view accounts with public pins
-- This allows anonymous users to see account info for accounts that have public pins
-- And simplifies pins RLS (no helper function needed)

-- ============================================================================
-- STEP 1: Update accounts RLS to allow anonymous users to view accounts with public pins
-- ============================================================================

-- Drop existing anonymous policy (if it exists)
DROP POLICY IF EXISTS "Anonymous users can view accounts with public posts" ON public.accounts;
DROP POLICY IF EXISTS "Anonymous users can view accounts with public content" ON public.accounts;

-- Create new policy that allows anonymous users to see accounts with public pins
-- This allows anonymous users to see account info for accounts that have public pins
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

COMMENT ON POLICY "Anonymous users can view accounts with public pins" ON public.accounts IS 
  'Allows anonymous users to view ONLY safe columns (id, first_name, last_name, image_url) for accounts that have public pins. Column-level GRANT ensures sensitive fields are never exposed. This enables displaying pin creator information in the feed securely.';

-- ============================================================================
-- STEP 2: Simplify pins RLS (no helper function needed)
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Public read access for pins" ON public.pins;

-- Create simplified policy using direct EXISTS query
-- This works because:
-- - For anonymous users: auth.uid() is NULL, so EXISTS returns FALSE (correct - they can't see private pins)
-- - For authenticated users: They can query accounts (policy allows it), so ownership check works
CREATE POLICY "Public read access for pins"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public pins are visible to everyone
    visibility = 'public'
    OR
    -- Private pins (only_me) are only visible to their creator
    -- For anonymous users, auth.uid() is NULL, so this condition is always FALSE
    -- For authenticated users, they can query accounts table, so ownership check works
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = pins.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY "Public read access for pins" ON public.pins IS
  'Allows anyone (authenticated or anonymous) to view public pins. Private pins (only_me) are only visible to their creator. For anonymous users, auth.uid() is NULL so private pin check always fails (correct behavior). For authenticated users, accounts table is queryable so ownership check works.';

-- ============================================================================
-- STEP 3: Add indexes for performance
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

