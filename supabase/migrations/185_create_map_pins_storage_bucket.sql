-- Create storage bucket for map pins media (photos and videos)
-- This bucket stores one photo or video per map pin
-- Path structure: {user_id}/map-pins/{pin_id}/{filename}

-- ============================================================================
-- STEP 1: Create map-pins-media bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'map-pins-media',
  'map-pins-media',
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
DROP POLICY IF EXISTS "Users can upload own map pin media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own map pin media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own map pin media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view map pin media" ON storage.objects;

-- Allow authenticated users to upload media for their own map pins
-- Path structure: {user_id}/map-pins/{pin_id}/{filename}
-- Policy checks that first folder matches auth.uid()
CREATE POLICY "Users can upload own map pin media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'map-pins-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own map pin media
CREATE POLICY "Users can update own map pin media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'map-pins-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'map-pins-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own map pin media
CREATE POLICY "Users can delete own map pin media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'map-pins-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access to map pin media
CREATE POLICY "Public can view map pin media"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'map-pins-media');




