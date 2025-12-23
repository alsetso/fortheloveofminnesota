-- Drop posts table and all dependencies
-- Migration 211: Remove posts table completely

-- ============================================================================
-- STEP 1: Drop all triggers on posts table
-- ============================================================================

DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
DROP TRIGGER IF EXISTS update_posts_slug ON public.posts;
DROP TRIGGER IF EXISTS update_posts_published_at ON public.posts;
DROP TRIGGER IF EXISTS update_posts_reading_time ON public.posts;

-- ============================================================================
-- STEP 2: Drop all functions that depend on posts
-- ============================================================================

-- Drop any functions that reference posts table
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND (
      proname LIKE '%post%' 
      OR pg_get_functiondef(oid) LIKE '%posts%'
    )
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
    EXCEPTION
      WHEN OTHERS THEN
        -- Continue if function doesn't exist or can't be dropped
        NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Drop all RLS policies on posts
-- ============================================================================

DROP POLICY IF EXISTS "posts_select" ON public.posts;
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
DROP POLICY IF EXISTS "posts_select_own" ON public.posts;
DROP POLICY IF EXISTS "posts_select_public" ON public.posts;
DROP POLICY IF EXISTS "posts_select_authenticated" ON public.posts;
DROP POLICY IF EXISTS "posts_select_anon" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_article" ON public.posts;
DROP POLICY IF EXISTS "posts_update_article" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_article" ON public.posts;

-- ============================================================================
-- STEP 4: Drop foreign key constraints (they'll be dropped with table, but explicit for clarity)
-- ============================================================================

-- Foreign keys will be dropped automatically with CASCADE, but we can be explicit
DO $$
BEGIN
  -- Drop foreign key constraints if they exist
  ALTER TABLE IF EXISTS public.posts DROP CONSTRAINT IF EXISTS posts_account_id_fkey;
  ALTER TABLE IF EXISTS public.posts DROP CONSTRAINT IF EXISTS posts_city_id_fkey;
  ALTER TABLE IF EXISTS public.posts DROP CONSTRAINT IF EXISTS posts_county_id_fkey;
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist, which is fine
    NULL;
END $$;

-- ============================================================================
-- STEP 5: Drop the posts table
-- ============================================================================

DROP TABLE IF EXISTS public.posts CASCADE;

-- ============================================================================
-- STEP 6: Drop enum types related to posts (if not used elsewhere)
-- ============================================================================

-- Only drop if not used by other tables
DO $$
BEGIN
  -- Check if post_type enum is used elsewhere
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE udt_name = 'post_type' 
    AND table_schema = 'public'
  ) THEN
    DROP TYPE IF EXISTS public.post_type CASCADE;
  END IF;

  -- Check if post_visibility enum is used elsewhere
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE udt_name = 'post_visibility' 
    AND table_schema = 'public'
  ) THEN
    DROP TYPE IF EXISTS public.post_visibility CASCADE;
  END IF;

  -- Check if post_media_type enum is used elsewhere
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE udt_name = 'post_media_type' 
    AND table_schema = 'public'
  ) THEN
    DROP TYPE IF EXISTS public.post_media_type CASCADE;
  END IF;
END $$;




