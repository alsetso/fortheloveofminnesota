-- Fix RLS policies for map_pins table
-- Ensure policies are properly created and accessible

-- ============================================================================
-- STEP 1: Drop existing policies (if any) to avoid conflicts
-- ============================================================================

DROP POLICY IF EXISTS "Public read access for map pins" ON public.map_pins;
DROP POLICY IF EXISTS "Users can insert own map pins" ON public.map_pins;
DROP POLICY IF EXISTS "Users can update own map pins" ON public.map_pins;
DROP POLICY IF EXISTS "Users can delete own map pins" ON public.map_pins;

-- ============================================================================
-- STEP 2: Ensure RLS is enabled
-- ============================================================================

ALTER TABLE public.map_pins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create RLS policies
-- ============================================================================

-- Policy: All pins are publicly readable (both authenticated and anonymous)
CREATE POLICY "Public read access for map pins"
  ON public.map_pins
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Authenticated users can insert their own pins
-- The account_id must belong to the authenticated user
CREATE POLICY "Users can insert own map pins"
  ON public.map_pins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Policy: Authenticated users can update their own pins
CREATE POLICY "Users can update own map pins"
  ON public.map_pins
  FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Policy: Authenticated users can delete their own pins
CREATE POLICY "Users can delete own map pins"
  ON public.map_pins
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 4: Grant necessary permissions
-- ============================================================================

-- Grant SELECT to authenticated and anon (for public read access)
GRANT SELECT ON public.map_pins TO authenticated;
GRANT SELECT ON public.map_pins TO anon;

-- Grant INSERT, UPDATE, DELETE to authenticated (RLS policies will control access)
GRANT INSERT, UPDATE, DELETE ON public.map_pins TO authenticated;

-- Note: No sequence grant needed - we use gen_random_uuid() for id generation



