-- Unify posts architecture: simple universal feed table
-- Updates posts to be universal, removes article-specific fields
-- Only supports simple post type

-- ============================================================================
-- STEP 1: Enable PostGIS extension if not already enabled
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- STEP 2: Create new post type enum
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type_new') THEN
    CREATE TYPE public.post_type_new AS ENUM (
      'simple'
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add new address columns (nullable initially)
-- ============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS county TEXT,
  ADD COLUMN IF NOT EXISTS full_address TEXT;

-- ============================================================================
-- STEP 4: Migrate data from old post_type to new type enum
-- ============================================================================

-- Add temporary column with new enum type
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS type_new public.post_type_new;

-- Migrate existing post_type values to new type
-- Map all to 'simple'
DO $$
DECLARE
  post_record RECORD;
  post_type_exists BOOLEAN;
BEGIN
  -- Check if post_type column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'post_type'
  ) INTO post_type_exists;
  
  IF post_type_exists THEN
    -- All existing posts become 'simple'
    UPDATE public.posts
    SET type_new = 'simple'::public.post_type_new
    WHERE type_new IS NULL;
  END IF;
END $$;

-- Set default for any remaining NULL values
UPDATE public.posts
SET type_new = 'simple'::public.post_type_new
WHERE type_new IS NULL;

-- ============================================================================
-- STEP 5: Migrate city_id and county_id to string fields
-- ============================================================================

-- Migrate city_id to city (if cities table exists)
DO $$
DECLARE
  cities_table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'cities'
  ) INTO cities_table_exists;
  
  IF cities_table_exists THEN
    UPDATE public.posts p
    SET city = c.name
    FROM public.cities c
    WHERE p.city_id = c.id
    AND p.city IS NULL;
  END IF;
END $$;

-- Migrate county_id to county (if counties table exists)
DO $$
DECLARE
  counties_table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'counties'
  ) INTO counties_table_exists;
  
  IF counties_table_exists THEN
    UPDATE public.posts p
    SET county = c.name
    FROM public.counties c
    WHERE p.county_id = c.id
    AND p.county IS NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Drop old columns and constraints
-- ============================================================================

-- Drop indexes on city_id and county_id
DROP INDEX IF EXISTS posts_city_id_idx;
DROP INDEX IF EXISTS posts_county_id_idx;

-- Drop foreign key constraints
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_city_id_fkey,
  DROP CONSTRAINT IF EXISTS posts_county_id_fkey;

-- Drop old columns
ALTER TABLE public.posts
  DROP COLUMN IF EXISTS city_id,
  DROP COLUMN IF EXISTS county_id;

-- Drop article-specific columns
ALTER TABLE public.posts
  DROP COLUMN IF EXISTS html_content,
  DROP COLUMN IF EXISTS excerpt,
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS reading_time_minutes,
  DROP COLUMN IF EXISTS meta_title,
  DROP COLUMN IF EXISTS meta_description,
  DROP COLUMN IF EXISTS canonical_url,
  DROP COLUMN IF EXISTS og_image,
  DROP COLUMN IF EXISTS featured_image,
  DROP COLUMN IF EXISTS media_type;

-- Rename type_new to post_type_new (for consistency with enum name)
-- Do this BEFORE dropping post_type so we can reference it if needed
DO $$
BEGIN
  -- If type_new exists, rename it to post_type_new
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'type_new'
  ) THEN
    ALTER TABLE public.posts RENAME COLUMN type_new TO post_type_new;
  -- If neither type_new, post_type_new, nor type exist, create post_type_new
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name IN ('post_type_new', 'type')
  ) THEN
    ALTER TABLE public.posts
      ADD COLUMN post_type_new public.post_type_new;
    -- Set default value for all rows
    UPDATE public.posts
    SET post_type_new = 'simple'::public.post_type_new
    WHERE post_type_new IS NULL;
  END IF;
END $$;

-- Drop old post_type column and related indexes (after renaming type_new)
DROP INDEX IF EXISTS posts_post_type_idx;
DROP INDEX IF EXISTS posts_article_public_idx;
DROP INDEX IF EXISTS posts_article_slug_idx;
DROP INDEX IF EXISTS posts_article_search_idx;

ALTER TABLE public.posts
  DROP COLUMN IF EXISTS post_type;

-- ============================================================================
-- STEP 7: Replace post_type_new with type
-- ============================================================================

-- Rename post_type_new to type (only if post_type_new exists and type doesn't)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'post_type_new'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.posts RENAME COLUMN post_type_new TO type;
  END IF;
END $$;

-- Make type NOT NULL with default (only if type column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.posts
      ALTER COLUMN type SET NOT NULL,
      ALTER COLUMN type SET DEFAULT 'simple'::public.post_type_new;
  END IF;
END $$;

-- Rename enum type
DROP TYPE IF EXISTS public.post_type CASCADE;
ALTER TYPE public.post_type_new RENAME TO post_type;

-- ============================================================================
-- STEP 8: Create indexes for new columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS posts_type_idx ON public.posts(type);
CREATE INDEX IF NOT EXISTS posts_city_idx ON public.posts(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_county_idx ON public.posts(county) WHERE county IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_state_idx ON public.posts(state) WHERE state IS NOT NULL;

-- ============================================================================
-- STEP 9: Structured tables removed - only simple posts are supported
-- ============================================================================

-- ============================================================================
-- STEP 10: Indexes for structured tables removed - only simple posts supported
-- ============================================================================

-- ============================================================================
-- STEP 11: Structured table triggers removed - only simple posts supported
-- ============================================================================

-- Ensure update_updated_at_column function exists (for posts table)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 14: Add comments
-- ============================================================================

COMMENT ON COLUMN public.posts.type IS 
  'Post type: simple (basic feed post)';

COMMENT ON COLUMN public.posts.city IS 
  'City name (string, not FK)';

COMMENT ON COLUMN public.posts.state IS 
  'State name (string)';

COMMENT ON COLUMN public.posts.zip IS 
  'ZIP code (string)';

COMMENT ON COLUMN public.posts.county IS 
  'County name (string, not FK)';

COMMENT ON COLUMN public.posts.full_address IS 
  'Full address string';


-- ============================================================================
-- STEP 12: Grant permissions (structured tables removed - only simple posts)
-- ============================================================================




