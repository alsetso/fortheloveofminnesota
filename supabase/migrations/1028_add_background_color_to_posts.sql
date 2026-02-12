-- Add background_color column to content.posts table
-- Stores the background color for posts: 'black', 'red', 'blue', or NULL

-- ============================================================================
-- STEP 1: Add background_color column to content.posts
-- ============================================================================

ALTER TABLE content.posts
  ADD COLUMN IF NOT EXISTS background_color TEXT
  CHECK (background_color IS NULL OR background_color IN ('black', 'red', 'blue'));

-- ============================================================================
-- STEP 2: Add comment
-- ============================================================================

COMMENT ON COLUMN content.posts.background_color IS 'Background color for post content. Valid values: black, red, blue, or NULL for default.';

-- ============================================================================
-- STEP 3: Update the view trigger function to include background_color
-- ============================================================================

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
    background_color = NEW.background_color,
    updated_at = NEW.updated_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
