-- Consolidate storage buckets: Create unified posts-media and pins-media buckets
-- This migration creates new buckets and sets up migration path without losing data

-- ============================================================================
-- STEP 1: Create posts-media bucket (unified bucket for all post media)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts-media',
  'posts-media',
  true, -- Public bucket - anyone can read
  104857600, -- 100MB limit (for videos)
  ARRAY[
    -- Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    -- Videos
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/ogg', 'video/3gpp', 'video/x-matroska'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600;

-- ============================================================================
-- STEP 2: Create pins-media bucket (unified bucket for all pin/map pin media)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pins-media',
  'pins-media',
  true, -- Public bucket - anyone can read
  104857600, -- 100MB limit (for videos)
  ARRAY[
    -- Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    -- Videos
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/ogg', 'video/3gpp', 'video/x-matroska'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600;

-- ============================================================================
-- STEP 3: Set up RLS policies for posts-media bucket
-- ============================================================================

-- Public read access
DROP POLICY IF EXISTS "Public can view posts media" ON storage.objects;
CREATE POLICY "Public can view posts media"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'posts-media');

-- Users can upload their own posts media
-- Path structure: {user_id}/posts/{post_id}/{filename}
DROP POLICY IF EXISTS "Users can upload own posts media" ON storage.objects;
CREATE POLICY "Users can upload own posts media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'posts-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own posts media
DROP POLICY IF EXISTS "Users can update own posts media" ON storage.objects;
CREATE POLICY "Users can update own posts media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'posts-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'posts-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own posts media
DROP POLICY IF EXISTS "Users can delete own posts media" ON storage.objects;
CREATE POLICY "Users can delete own posts media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'posts-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- STEP 4: Set up RLS policies for pins-media bucket
-- ============================================================================

-- Public read access
DROP POLICY IF EXISTS "Public can view pins media" ON storage.objects;
CREATE POLICY "Public can view pins media"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'pins-media');

-- Users can upload their own pins media
-- Path structure: {user_id}/pins/{pin_id}/{filename}
DROP POLICY IF EXISTS "Users can upload own pins media" ON storage.objects;
CREATE POLICY "Users can upload own pins media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pins-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own pins media
DROP POLICY IF EXISTS "Users can update own pins media" ON storage.objects;
CREATE POLICY "Users can update own pins media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pins-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'pins-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own pins media
DROP POLICY IF EXISTS "Users can delete own pins media" ON storage.objects;
CREATE POLICY "Users can delete own pins media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pins-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- STEP 5: Migration notes
-- ============================================================================
-- Note: File migration between buckets must be done via Supabase Storage API
-- Old buckets remain active - no data loss risk
-- Update application code to use new bucket names gradually

-- ============================================================================
-- STEP 7: Verification
-- ============================================================================

DO $$
DECLARE
  posts_media_exists BOOLEAN;
  pins_media_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'posts-media') INTO posts_media_exists;
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'pins-media') INTO pins_media_exists;
  
  RAISE NOTICE 'Storage Bucket Consolidation Status:';
  RAISE NOTICE '  posts-media bucket: %', CASE WHEN posts_media_exists THEN '✅ Created' ELSE '❌ Failed' END;
  RAISE NOTICE '  pins-media bucket: %', CASE WHEN pins_media_exists THEN '✅ Created' ELSE '❌ Failed' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Old buckets (feed-images, map-pins-media, etc.) remain active';
  RAISE NOTICE '  2. New code should use posts-media and pins-media';
  RAISE NOTICE '  3. Migrate files from old buckets when ready (use Storage API)';
  RAISE NOTICE '  4. Update application code to use new bucket names';
  RAISE NOTICE '  5. After migration complete, drop old buckets';
END $$;
