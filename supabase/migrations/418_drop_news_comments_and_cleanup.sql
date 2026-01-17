-- Drop news.comments table and related functions
-- Part of cleanup: removing comment functionality from news articles
-- WARNING: This is destructive and will remove all comment data

-- ============================================================================
-- STEP 1: Drop RPC function for comments
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_accounts_for_comments(UUID[]) CASCADE;

-- ============================================================================
-- STEP 2: Drop news.comments table (cascades to indexes, triggers, policies)
-- ============================================================================

DROP TABLE IF EXISTS news.comments CASCADE;

-- ============================================================================
-- STEP 3: Verify cleanup
-- ============================================================================

DO $$
BEGIN
  -- Check if table still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'news' AND table_name = 'comments'
  ) THEN
    RAISE EXCEPTION 'news.comments table still exists after drop';
  END IF;
  
  -- Check if function still exists
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_accounts_for_comments'
  ) THEN
    RAISE EXCEPTION 'get_accounts_for_comments function still exists after drop';
  END IF;
  
  RAISE NOTICE 'Successfully dropped news.comments table and related functions';
END;
$$;
