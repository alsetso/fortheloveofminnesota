-- Add admin RLS policies for mention_types table
-- Allows authenticated users with admin role to INSERT, UPDATE, DELETE

-- ============================================================================
-- STEP 1: Ensure is_admin() function exists and is accessible
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.user_id = auth.uid()
    AND accounts.role = 'admin'::public.account_role
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- ============================================================================
-- STEP 2: Grant INSERT and UPDATE permissions to authenticated users
-- (RLS policies will restrict to admins only)
-- ============================================================================

GRANT INSERT, UPDATE, DELETE ON public.mention_types TO authenticated;

-- ============================================================================
-- STEP 3: Add admin RLS policies for mention_types
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can insert mention types" ON public.mention_types;
DROP POLICY IF EXISTS "Admins can update mention types" ON public.mention_types;
DROP POLICY IF EXISTS "Admins can delete mention types" ON public.mention_types;

-- Only admins can insert mention types
CREATE POLICY "Admins can insert mention types"
  ON public.mention_types
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Only admins can update mention types
CREATE POLICY "Admins can update mention types"
  ON public.mention_types
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins can delete mention types
CREATE POLICY "Admins can delete mention types"
  ON public.mention_types
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
