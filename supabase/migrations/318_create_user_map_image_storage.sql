-- Create storage bucket for user map pin images
-- This bucket stores images for map pins
-- Path structure: {user_id}/map-pins/{pin_id}/{filename}

-- ============================================================================
-- STEP 1: Create user-map-image-storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-map-image-storage',
  'user-map-image-storage',
  true,
  10485760, -- 10MB limit for images
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Create Storage Policies
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload own map pin images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own map pin images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own map pin images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view map pin images" ON storage.objects;

-- Allow authenticated users to upload images for their own map pins
-- Path structure: {user_id}/map-pins/{pin_id}/{filename}
-- Policy checks that first folder matches auth.uid()
CREATE POLICY "Users can upload own map pin images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-map-image-storage' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own map pin images
CREATE POLICY "Users can update own map pin images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-map-image-storage' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-map-image-storage' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own map pin images
CREATE POLICY "Users can delete own map pin images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-map-image-storage' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access to map pin images
CREATE POLICY "Public can view map pin images"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'user-map-image-storage');

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================

COMMENT ON TABLE storage.buckets IS 'Storage buckets for user-generated content';
COMMENT ON COLUMN storage.buckets.id IS 'Unique bucket identifier';

