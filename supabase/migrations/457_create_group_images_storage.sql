-- Create storage bucket for group images
-- This bucket stores group profile images and cover images
-- 
-- NOTE: Storage policies must be created through the Supabase Dashboard
-- or using the service role key. Run this migration first, then create
-- the policies manually or use the Supabase CLI with service role.

-- ============================================================================
-- STEP 1: Create group-images bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-images',
  'group-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Create Storage Policies
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Group admins can upload group images" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can update group images" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can delete group images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view group images" ON storage.objects;

-- Allow authenticated users to upload group images
-- Path structure: {user_id}/groups/{group_id}/{image_url|cover_image_url}/{filename}
-- Policy checks that user is authenticated and can upload to their own path
CREATE POLICY "Group admins can upload group images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update group images
CREATE POLICY "Group admins can update group images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'group-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'group-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete group images
CREATE POLICY "Group admins can delete group images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'group-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access to group images
CREATE POLICY "Public can view group images"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'group-images');

-- ============================================================================
-- STEP 3: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
