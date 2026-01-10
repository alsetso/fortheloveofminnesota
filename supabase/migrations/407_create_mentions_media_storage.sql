-- Create storage bucket for mentions media (photos and videos)
-- This bucket stores one photo or video per mention
-- Path structure: {user_id}/mentions/{filename}
-- Note: mention_id can be included in path for organization, but policy only checks first folder (user_id)

-- ============================================================================
-- STEP 1: Create mentions-media bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mentions-media',
  'mentions-media',
  true,
  104857600, -- 100MB limit (for videos)
  ARRAY[
    -- Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    -- Videos
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Create Storage Policies
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload own mention media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own mention media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own mention media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view mention media" ON storage.objects;

-- Allow authenticated users to upload media for their own mentions
-- Path structure: {user_id}/mentions/{mention_id}/{filename}
-- Policy checks that first folder matches auth.uid()
CREATE POLICY "Users can upload own mention media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'mentions-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own mention media
CREATE POLICY "Users can update own mention media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'mentions-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'mentions-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own mention media
CREATE POLICY "Users can delete own mention media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'mentions-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access to mention media
CREATE POLICY "Public can view mention media"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'mentions-media');

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================

COMMENT ON BUCKET mentions-media IS 'Storage bucket for mention media (images and videos). Path structure: {user_id}/mentions/{filename} (mention_id optional for organization)';

