-- Fix map_pins RLS policies using SECURITY DEFINER helper function
-- This ensures account ownership checks work even when accounts table has RLS

-- ============================================================================
-- STEP 1: Ensure user_owns_account helper function exists
-- ============================================================================
-- This function bypasses RLS on accounts table to check ownership

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
-- STEP 2: Drop existing policies (if any) to avoid conflicts
-- ============================================================================

DROP POLICY IF EXISTS "Public read access for map pins" ON public.map_pins;
DROP POLICY IF EXISTS "Users can insert own map pins" ON public.map_pins;
DROP POLICY IF EXISTS "Users can update own map pins" ON public.map_pins;
DROP POLICY IF EXISTS "Users can delete own map pins" ON public.map_pins;

-- ============================================================================
-- STEP 3: Ensure RLS is enabled
-- ============================================================================

ALTER TABLE public.map_pins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Grant base permissions (required for RLS to work)
-- ============================================================================

-- Grant SELECT to both authenticated and anon (for public read access)
GRANT SELECT ON public.map_pins TO authenticated;
GRANT SELECT ON public.map_pins TO anon;

-- Grant INSERT, UPDATE, DELETE to authenticated (RLS policies will control access)
GRANT INSERT, UPDATE, DELETE ON public.map_pins TO authenticated;

-- ============================================================================
-- STEP 5: Create RLS policies using helper function
-- ============================================================================

-- Policy: All pins are publicly readable (both authenticated and anonymous)
CREATE POLICY "Public read access for map pins"
  ON public.map_pins
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Authenticated users can insert their own pins
-- Uses helper function to check account ownership (bypasses accounts RLS)
CREATE POLICY "Users can insert own map pins"
  ON public.map_pins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

-- Policy: Authenticated users can update their own pins
CREATE POLICY "Users can update own map pins"
  ON public.map_pins
  FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

-- Policy: Authenticated users can delete their own pins
CREATE POLICY "Users can delete own map pins"
  ON public.map_pins
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );



