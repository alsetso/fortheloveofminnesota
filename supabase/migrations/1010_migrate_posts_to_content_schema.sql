-- Migrate public.posts to content.posts schema
-- This migration moves the posts table to a dedicated content schema for better organization

-- ============================================================================
-- STEP 1: Create content schema if it doesn't exist
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS content;

-- Grant usage on content schema
GRANT USAGE ON SCHEMA content TO authenticated, anon;

-- ============================================================================
-- STEP 2: Create content.posts table with same structure as public.posts
-- ============================================================================

CREATE TABLE content.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Type and content
  post_type public.post_type NOT NULL DEFAULT 'general'::public.post_type,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  html_content TEXT,
  excerpt TEXT,
  
  -- Media
  images JSONB DEFAULT '[]'::jsonb,
  featured_image TEXT,
  media_type public.post_media_type NOT NULL DEFAULT 'text'::public.post_media_type,
  
  -- Location
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  county_id UUID REFERENCES public.counties(id) ON DELETE SET NULL,
  
  -- Map reference
  map_id UUID REFERENCES public.map(id) ON DELETE SET NULL,
  
  -- Metadata
  visibility public.post_visibility NOT NULL DEFAULT 'members_only'::public.post_visibility,
  slug TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  reading_time_minutes INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  
  -- SEO (articles only, nullable)
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  og_image TEXT,
  
  -- Additional fields that may exist
  mention_type_id UUID REFERENCES public.mention_types(id) ON DELETE SET NULL,
  mention_ids JSONB DEFAULT '[]'::jsonb,
  map_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT posts_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  CONSTRAINT posts_excerpt_length CHECK (excerpt IS NULL OR char_length(excerpt) <= 500),
  CONSTRAINT posts_meta_title_length CHECK (meta_title IS NULL OR char_length(meta_title) <= 70),
  CONSTRAINT posts_meta_description_length CHECK (meta_description IS NULL OR char_length(meta_description) <= 160),
  CONSTRAINT posts_view_count_non_negative CHECK (view_count >= 0),
  CONSTRAINT posts_reading_time_non_negative CHECK (reading_time_minutes IS NULL OR reading_time_minutes >= 0),
  CONSTRAINT posts_content_length CHECK (
    (post_type != 'article' AND char_length(content) >= 1 AND char_length(content) <= 10000) OR
    (post_type = 'article')
  ),
  CONSTRAINT posts_slug_required_articles CHECK (
    post_type != 'article' OR slug IS NOT NULL
  )
);

-- ============================================================================
-- STEP 3: Migrate all public posts from public.posts to content.posts
-- ============================================================================

INSERT INTO content.posts (
  id, account_id, post_type, title, content, html_content, excerpt,
  images, featured_image, media_type, city_id, county_id, map_id,
  visibility, slug, published_at, reading_time_minutes, view_count,
  meta_title, meta_description, canonical_url, og_image,
  mention_type_id, mention_ids, map_data,
  created_at, updated_at
)
SELECT 
  id, account_id, post_type, title, content, html_content, excerpt,
  images, featured_image, media_type, city_id, county_id, map_id,
  visibility, slug, published_at, reading_time_minutes, view_count,
  meta_title, meta_description, canonical_url, og_image,
  mention_type_id, mention_ids, map_data,
  created_at, updated_at
FROM public.posts
WHERE visibility = 'public'::public.post_visibility
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: Create indexes on content.posts (same as public.posts)
-- ============================================================================

CREATE INDEX posts_post_type_idx ON content.posts(post_type);
CREATE INDEX posts_visibility_idx ON content.posts(visibility);
CREATE INDEX posts_created_at_idx ON content.posts(created_at DESC);
CREATE INDEX posts_visibility_created_at_idx ON content.posts(visibility, created_at DESC);
CREATE INDEX posts_city_id_idx ON content.posts(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX posts_county_id_idx ON content.posts(county_id) WHERE county_id IS NOT NULL;
CREATE INDEX posts_map_id_idx ON content.posts(map_id) WHERE map_id IS NOT NULL;
CREATE INDEX posts_map_id_visibility_created_idx ON content.posts(map_id, visibility, created_at DESC) WHERE map_id IS NOT NULL;
CREATE INDEX posts_account_id_idx ON content.posts(account_id);
CREATE INDEX posts_mention_type_id_idx ON content.posts(mention_type_id) WHERE mention_type_id IS NOT NULL;

-- Article-specific indexes
CREATE INDEX posts_article_public_idx ON content.posts(visibility, published_at DESC) 
  WHERE post_type = 'article' AND visibility = 'public' AND published_at IS NOT NULL;
CREATE UNIQUE INDEX posts_article_slug_idx ON content.posts(slug) 
  WHERE post_type = 'article' AND slug IS NOT NULL;

-- Full-text search for articles
CREATE INDEX posts_article_search_idx ON content.posts USING GIN (
  to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(html_content, content, ''))
) WHERE post_type = 'article';

-- ============================================================================
-- STEP 5: Update foreign key references
-- ============================================================================

-- Update pins.post_id to reference content.posts
ALTER TABLE public.pins
  DROP CONSTRAINT IF EXISTS pins_post_id_fkey;

ALTER TABLE public.pins
  ADD CONSTRAINT pins_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES content.posts(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 6: Create triggers on content.posts
-- ============================================================================

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON content.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_post_metadata
  BEFORE INSERT OR UPDATE OF images, html_content, content, visibility ON content.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_metadata();

-- ============================================================================
-- STEP 7: Enable RLS and create policies on content.posts
-- ============================================================================

ALTER TABLE content.posts ENABLE ROW LEVEL SECURITY;

-- Anonymous: Can view public posts only
CREATE POLICY "posts_select_anon"
  ON content.posts FOR SELECT
  TO anon
  USING (
    visibility = 'public'::public.post_visibility
    AND (
      map_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.map
        WHERE map.id = content.posts.map_id
        AND map.visibility = 'public'
        AND map.is_active = true
      )
    )
  );

-- Authenticated: Can view public posts and own posts (including drafts)
CREATE POLICY "posts_select_authenticated"
  ON content.posts FOR SELECT
  TO authenticated
  USING (
    (
      -- Own posts (including drafts)
      public.user_owns_account(account_id)
    )
    OR (
      -- Public posts
      visibility = 'public'::public.post_visibility
      AND (
        -- No map (general post)
        map_id IS NULL
        OR (
          -- Map exists and is active
          EXISTS (
            SELECT 1 FROM public.map
            WHERE map.id = content.posts.map_id
            AND map.is_active = true
            AND (
              -- Public map: anyone can see
              map.visibility = 'public'
              OR
              -- Private map: must be member
              (
                map.visibility = 'private'
                AND public.is_map_member(
                  content.posts.map_id,
                  (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
                )
              )
            )
          )
        )
      )
    )
  );

-- Authenticated: Can insert posts for own account
CREATE POLICY "posts_insert"
  ON content.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.user_owns_account(account_id)
    AND (
      map_id IS NULL
      OR (
        EXISTS (
          SELECT 1 FROM public.map
          WHERE map.id = content.posts.map_id
          AND map.is_active = true
          AND (
            (
              map.visibility = 'public'
              AND COALESCE((map.settings->'collaboration'->>'allow_posts')::boolean, false) = true
            )
            OR
            (
              map.visibility = 'private'
              AND public.is_map_member(
                content.posts.map_id,
                (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
              )
              AND COALESCE((map.settings->'collaboration'->>'allow_posts')::boolean, false) = true
            )
            OR
            public.is_map_manager(
              content.posts.map_id,
              (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
            )
          )
        )
      )
    )
  );

-- Authenticated: Can update own posts
CREATE POLICY "posts_update"
  ON content.posts FOR UPDATE
  TO authenticated
  USING (
    public.user_owns_account(account_id)
    AND (
      map_id IS NULL
      OR public.is_map_member(
        map_id,
        (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
      )
      OR public.user_owns_account(account_id)
    )
  )
  WITH CHECK (
    public.user_owns_account(account_id)
    AND (
      map_id IS NULL
      OR (
        EXISTS (
          SELECT 1 FROM public.map
          WHERE map.id = content.posts.map_id
          AND map.is_active = true
          AND (
            (
              map.visibility = 'public'
              AND COALESCE((map.settings->'collaboration'->>'allow_posts')::boolean, false) = true
            )
            OR
            (
              map.visibility = 'private'
              AND public.is_map_member(
                content.posts.map_id,
                (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
              )
              AND COALESCE((map.settings->'collaboration'->>'allow_posts')::boolean, false) = true
            )
            OR
            public.is_map_manager(
              content.posts.map_id,
              (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
            )
          )
        )
      )
    )
  );

-- Authenticated: Can delete own posts
CREATE POLICY "posts_delete"
  ON content.posts FOR DELETE
  TO authenticated
  USING (
    public.user_owns_account(account_id)
    OR
    (
      map_id IS NOT NULL
      AND public.is_map_manager(
        map_id,
        (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

-- ============================================================================
-- STEP 8: Grant permissions on content.posts
-- ============================================================================

GRANT SELECT ON content.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON content.posts TO authenticated;

-- ============================================================================
-- STEP 9: Create view public.posts for backward compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.posts AS
SELECT * FROM content.posts;

-- Grant permissions on view
GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;

-- Create INSTEAD OF triggers for INSERT, UPDATE, DELETE on view
CREATE OR REPLACE FUNCTION public.posts_view_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO content.posts VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.posts_view_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE content.posts SET
    account_id = NEW.account_id,
    post_type = NEW.post_type,
    title = NEW.title,
    content = NEW.content,
    html_content = NEW.html_content,
    excerpt = NEW.excerpt,
    images = NEW.images,
    featured_image = NEW.featured_image,
    media_type = NEW.media_type,
    city_id = NEW.city_id,
    county_id = NEW.county_id,
    map_id = NEW.map_id,
    visibility = NEW.visibility,
    slug = NEW.slug,
    published_at = NEW.published_at,
    reading_time_minutes = NEW.reading_time_minutes,
    view_count = NEW.view_count,
    meta_title = NEW.meta_title,
    meta_description = NEW.meta_description,
    canonical_url = NEW.canonical_url,
    og_image = NEW.og_image,
    mention_type_id = NEW.mention_type_id,
    mention_ids = NEW.mention_ids,
    map_data = NEW.map_data,
    updated_at = NEW.updated_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.posts_view_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM content.posts WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER posts_view_insert_trigger
  INSTEAD OF INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.posts_view_insert();

CREATE TRIGGER posts_view_update_trigger
  INSTEAD OF UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.posts_view_update();

CREATE TRIGGER posts_view_delete_trigger
  INSTEAD OF DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.posts_view_delete();

-- ============================================================================
-- STEP 10: Handle remaining non-public posts in public.posts
-- ============================================================================

-- Note: Only public posts have been migrated to content.posts
-- Non-public posts (draft, members_only, archived) remain in public.posts
-- The view public.posts will show content.posts (public posts only)
-- Non-public posts can be accessed directly from public.posts table

-- Drop triggers first (they'll be recreated if needed for remaining posts)
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
DROP TRIGGER IF EXISTS update_post_metadata ON public.posts;

-- Drop policies (they'll be recreated if needed for remaining posts)
DROP POLICY IF EXISTS "posts_select_anon" ON public.posts;
DROP POLICY IF EXISTS "posts_select_authenticated" ON public.posts;
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "posts_delete" ON public.posts;

-- Only drop public.posts table if all posts have been migrated
-- If there are non-public posts remaining, keep the table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.posts 
    WHERE visibility != 'public'::public.post_visibility
  ) THEN
    -- All posts migrated, safe to drop
    DROP TABLE IF EXISTS public.posts CASCADE;
  ELSE
    -- Non-public posts remain, keep table but ensure it only contains non-public posts
    DELETE FROM public.posts WHERE visibility = 'public'::public.post_visibility;
  END IF;
END $$;

-- ============================================================================
-- STEP 11: Add comments
-- ============================================================================

COMMENT ON SCHEMA content IS 'Content schema for posts and other content types';
COMMENT ON TABLE content.posts IS 'Unified table for all post types: general, article, ad, job, listing';
COMMENT ON VIEW public.posts IS 'Backward compatibility view for content.posts. All operations are redirected to content.posts.';
