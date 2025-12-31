-- Storage policies for gov-people-storage bucket
-- 
-- IMPORTANT: This file must be run with SERVICE ROLE permissions
-- Run using: supabase db execute --file 305a_create_gov_people_storage_policies.sql --service-role
-- Or create these policies manually in the Supabase Dashboard under Storage > gov-people-storage > Policies

-- ============================================================================
-- STEP 1: Ensure is_admin() function exists and is accessible
-- ============================================================================

-- Ensure is_admin() function exists and is correct
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- ============================================================================
-- STEP 2: Create RLS policies for gov-people-storage bucket
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can upload people photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update people photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete people photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view people photos" ON storage.objects;

-- Allow admins to upload people photos
-- Uses is_admin() function to check if user has admin role
CREATE POLICY "Admins can upload people photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'gov-people-storage' AND
    public.is_admin()
  );

-- Allow admins to update people photos
CREATE POLICY "Admins can update people photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'gov-people-storage' AND
    public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'gov-people-storage' AND
    public.is_admin()
  );

-- Allow admins to delete people photos
CREATE POLICY "Admins can delete people photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'gov-people-storage' AND
    public.is_admin()
  );

-- Allow public to view people photos (for displaying on public pages)
CREATE POLICY "Public can view people photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'gov-people-storage');

COMMENT ON POLICY "Admins can upload people photos" ON storage.objects IS 
  'Allows authenticated users with admin role to upload photos for government people';
COMMENT ON POLICY "Admins can update people photos" ON storage.objects IS 
  'Allows authenticated users with admin role to update photos for government people';
COMMENT ON POLICY "Admins can delete people photos" ON storage.objects IS 
  'Allows authenticated users with admin role to delete photos for government people';
COMMENT ON POLICY "Public can view people photos" ON storage.objects IS 
  'Allows public read access to gov-people-storage bucket for displaying photos on public pages';

