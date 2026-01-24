-- Add view_count column to posts table if it doesn't exist
-- This migration is idempotent and safe to run multiple times

-- ============================================================================
-- STEP 1: Add view_count column if it doesn't exist
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'view_count'
  ) THEN
    ALTER TABLE public.posts 
      ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
    
    -- Add constraint
    ALTER TABLE public.posts 
      ADD CONSTRAINT posts_view_count_non_negative CHECK (view_count >= 0);
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS posts_view_count_idx
      ON public.posts (view_count DESC)
      WHERE view_count > 0;
    
    -- Add comment
    COMMENT ON COLUMN public.posts.view_count IS 
      'Total number of page views for this post. Updated automatically by record_page_view function.';
  END IF;
END $$;
