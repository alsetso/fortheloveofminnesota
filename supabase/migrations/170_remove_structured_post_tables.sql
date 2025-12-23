-- Remove structured post tables and related code
-- Cleanup migration after simplifying to only simple posts
-- This removes: deals, buy_boxes, funding_available, funding_needed, jobs tables

-- ============================================================================
-- STEP 1: Drop triggers for structured tables
-- ============================================================================

DROP TRIGGER IF EXISTS set_post_type_from_deals ON public.deals;
DROP TRIGGER IF EXISTS set_post_type_from_buy_boxes ON public.buy_boxes;
DROP TRIGGER IF EXISTS set_post_type_from_funding_available ON public.funding_available;
DROP TRIGGER IF EXISTS set_post_type_from_funding_needed ON public.funding_needed;
DROP TRIGGER IF EXISTS set_post_type_from_jobs ON public.jobs;

DROP TRIGGER IF EXISTS update_deals_updated_at ON public.deals;
DROP TRIGGER IF EXISTS update_buy_boxes_updated_at ON public.buy_boxes;
DROP TRIGGER IF EXISTS update_funding_available_updated_at ON public.funding_available;
DROP TRIGGER IF EXISTS update_funding_needed_updated_at ON public.funding_needed;
DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;

-- ============================================================================
-- STEP 2: Drop functions related to structured tables
-- ============================================================================

DROP FUNCTION IF EXISTS public.set_post_type_from_structured_table() CASCADE;
DROP FUNCTION IF EXISTS public.geojson_to_geometry(JSONB) CASCADE;

-- ============================================================================
-- STEP 3: Drop indexes for structured tables
-- ============================================================================

DROP INDEX IF EXISTS deals_post_id_idx;
DROP INDEX IF EXISTS buy_boxes_post_id_idx;
DROP INDEX IF EXISTS buy_boxes_polygon_area_idx;
DROP INDEX IF EXISTS funding_available_post_id_idx;
DROP INDEX IF EXISTS funding_needed_post_id_idx;
DROP INDEX IF EXISTS jobs_post_id_idx;
DROP INDEX IF EXISTS jobs_business_id_idx;
DROP INDEX IF EXISTS jobs_status_idx;

-- ============================================================================
-- STEP 4: Drop structured tables (CASCADE will handle foreign keys)
-- ============================================================================

DROP TABLE IF EXISTS public.deals CASCADE;
DROP TABLE IF EXISTS public.buy_boxes CASCADE;
DROP TABLE IF EXISTS public.funding_available CASCADE;
DROP TABLE IF EXISTS public.funding_needed CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;

-- ============================================================================
-- STEP 5: Update post_type enum to only have 'simple'
-- ============================================================================

-- First, ensure all existing posts are 'simple'
UPDATE public.posts
SET type = 'simple'::public.post_type
WHERE type IS NOT NULL;

-- Create new enum with only 'simple'
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type_simple_only') THEN
    CREATE TYPE public.post_type_simple_only AS ENUM ('simple');
  END IF;
END $$;

-- Add temporary column
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS type_temp public.post_type_simple_only;

-- Migrate all posts to 'simple'
UPDATE public.posts
SET type_temp = 'simple'::public.post_type_simple_only
WHERE type_temp IS NULL;

-- Make it NOT NULL
ALTER TABLE public.posts
  ALTER COLUMN type_temp SET NOT NULL,
  ALTER COLUMN type_temp SET DEFAULT 'simple'::public.post_type_simple_only;

-- Drop old column and rename new one
ALTER TABLE public.posts
  DROP COLUMN IF EXISTS type;

ALTER TABLE public.posts
  RENAME COLUMN type_temp TO type;

-- Drop old enum and rename new one
DROP TYPE IF EXISTS public.post_type CASCADE;
ALTER TYPE public.post_type_simple_only RENAME TO post_type;

-- ============================================================================
-- STEP 6: Update comments to reflect simple posts only
-- ============================================================================

COMMENT ON COLUMN public.posts.type IS 
  'Post type: simple (basic feed post)';

-- ============================================================================
-- STEP 7: Cleanup - remove any remaining references
-- ============================================================================

-- Drop any remaining comments on structured tables (if they exist)
-- These will fail silently if tables don't exist, which is fine







