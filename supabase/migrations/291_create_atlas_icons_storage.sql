-- Create storage bucket for atlas type icons
-- Allows admins to upload custom icons for atlas types

-- ============================================================================
-- STEP 1: Create storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'atlas_icons_storage',
  'atlas_icons_storage',
  true, -- Public bucket so icons can be accessed directly
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Create storage policies
-- ============================================================================

-- Allow public read access to all files
CREATE POLICY "atlas_icons_public_read"
ON storage.objects
FOR SELECT
TO authenticated, anon
USING (bucket_id = 'atlas_icons_storage');

-- Allow authenticated users to upload files (admin check done at API level)
CREATE POLICY "atlas_icons_authenticated_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'atlas_icons_storage'
);

-- Allow authenticated users to update files (admin check done at API level)
CREATE POLICY "atlas_icons_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'atlas_icons_storage')
WITH CHECK (bucket_id = 'atlas_icons_storage');

-- Allow authenticated users to delete files (admin check done at API level)
CREATE POLICY "atlas_icons_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'atlas_icons_storage');

