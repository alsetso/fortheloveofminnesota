-- Add admin RLS policies for civic tables (orgs, people, roles)
-- Allows authenticated users with admin role to INSERT, UPDATE, DELETE

-- ============================================================================
-- STEP 1: Ensure is_admin() function exists
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
-- STEP 2: Add admin policies for civic.orgs
-- ============================================================================

DROP POLICY IF EXISTS "Admins can insert orgs" ON civic.orgs;
DROP POLICY IF EXISTS "Admins can update orgs" ON civic.orgs;
DROP POLICY IF EXISTS "Admins can delete orgs" ON civic.orgs;

CREATE POLICY "Admins can insert orgs"
  ON civic.orgs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update orgs"
  ON civic.orgs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete orgs"
  ON civic.orgs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 3: Add admin policies for civic.people
-- ============================================================================

DROP POLICY IF EXISTS "Admins can insert people" ON civic.people;
DROP POLICY IF EXISTS "Admins can update people" ON civic.people;
DROP POLICY IF EXISTS "Admins can delete people" ON civic.people;

CREATE POLICY "Admins can insert people"
  ON civic.people
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update people"
  ON civic.people
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete people"
  ON civic.people
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 4: Add admin policies for civic.roles
-- ============================================================================

DROP POLICY IF EXISTS "Admins can insert roles" ON civic.roles;
DROP POLICY IF EXISTS "Admins can update roles" ON civic.roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON civic.roles;

CREATE POLICY "Admins can insert roles"
  ON civic.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update roles"
  ON civic.roles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete roles"
  ON civic.roles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 5: Grant UPDATE permissions on public views
-- ============================================================================

-- The views need UPDATE permissions for admins to work through them
GRANT UPDATE ON public.orgs TO authenticated;
GRANT UPDATE ON public.people TO authenticated;
GRANT UPDATE ON public.roles TO authenticated;

