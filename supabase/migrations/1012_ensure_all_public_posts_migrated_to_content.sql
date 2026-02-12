-- Ensure all public posts are migrated from public.posts to content.posts
-- This migration ensures content.posts has the correct structure and migrates all public posts

-- ============================================================================
-- STEP 1: Ensure content.posts table has correct structure matching public.posts
-- ============================================================================

-- Check if content.posts exists and has the right structure
-- If it exists with wrong structure, we need to handle it
DO $$
BEGIN
  -- Check if content.posts exists but has wrong structure (author_account_id instead of account_id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'content' 
    AND table_name = 'posts' 
    AND column_name = 'author_account_id'
  ) THEN
    -- Drop the existing content.posts if it has wrong structure (it's empty anyway)
    DROP TABLE IF EXISTS content.posts CASCADE;
  END IF;
END $$;

-- Create content.posts table with correct structure matching public.posts
CREATE TABLE IF NOT EXISTS content.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  visibility public.post_visibility NOT NULL DEFAULT 'draft'::public.post_visibility,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  mention_ids JSONB,
  images JSONB,
  map_data JSONB,
  map_type VARCHAR,
  map_geometry JSONB,
  map_center GEOMETRY,
  map_hide_pin BOOLEAN,
  map_screenshot TEXT,
  map_bounds GEOMETRY,
  view_count INTEGER NOT NULL DEFAULT 0,
  mention_type_id UUID REFERENCES public.mention_types(id) ON DELETE SET NULL,
  map_id UUID REFERENCES public.map(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT posts_view_count_non_negative CHECK (view_count >= 0)
);

-- ============================================================================
-- STEP 2: Columns already included in table creation above
-- ============================================================================

-- ============================================================================
-- STEP 3: Migrate all public posts from public.posts to content.posts
-- ============================================================================

INSERT INTO content.posts (
  id, account_id, title, content, visibility,
  created_at, updated_at, mention_ids, images, map_data,
  map_type, map_geometry, map_center, map_hide_pin, map_screenshot, map_bounds,
  view_count, mention_type_id, map_id
)
SELECT 
  id, 
  account_id, 
  title,
  content,
  visibility,
  created_at, 
  updated_at,
  mention_ids,
  images,
  map_data,
  map_type,
  map_geometry,
  map_center,
  map_hide_pin,
  map_screenshot,
  map_bounds,
  view_count,
  mention_type_id,
  map_id
FROM public.posts
WHERE visibility = 'public'::public.post_visibility
ON CONFLICT (id) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  visibility = EXCLUDED.visibility,
  mention_ids = EXCLUDED.mention_ids,
  images = EXCLUDED.images,
  map_data = EXCLUDED.map_data,
  map_type = EXCLUDED.map_type,
  map_geometry = EXCLUDED.map_geometry,
  map_center = EXCLUDED.map_center,
  map_hide_pin = EXCLUDED.map_hide_pin,
  map_screenshot = EXCLUDED.map_screenshot,
  map_bounds = EXCLUDED.map_bounds,
  view_count = EXCLUDED.view_count,
  mention_type_id = EXCLUDED.mention_type_id,
  map_id = EXCLUDED.map_id,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 4: Create indexes on content.posts
-- ============================================================================

CREATE INDEX IF NOT EXISTS posts_visibility_idx ON content.posts(visibility);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON content.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_visibility_created_at_idx ON content.posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_map_id_idx ON content.posts(map_id) WHERE map_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_map_id_visibility_created_idx ON content.posts(map_id, visibility, created_at DESC) WHERE map_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_account_id_idx ON content.posts(account_id);
CREATE INDEX IF NOT EXISTS posts_mention_type_id_idx ON content.posts(mention_type_id) WHERE mention_type_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Grant permissions on content.posts
-- ============================================================================

GRANT SELECT ON content.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON content.posts TO authenticated;

-- ============================================================================
-- STEP 6: Verification
-- ============================================================================

DO $$
DECLARE
  public_posts_count INTEGER;
  content_posts_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_posts_count FROM public.posts WHERE visibility = 'public';
  SELECT COUNT(*) INTO content_posts_count FROM content.posts WHERE visibility = 'public';
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.posts (public visibility): %', public_posts_count;
  RAISE NOTICE '  content.posts (public visibility): %', content_posts_count;
  
  IF content_posts_count >= public_posts_count THEN
    RAISE NOTICE '✅ All public posts migrated successfully!';
  ELSE
    RAISE WARNING '⚠️  Migration incomplete. Expected %, got %.', public_posts_count, content_posts_count;
  END IF;
END $$;
