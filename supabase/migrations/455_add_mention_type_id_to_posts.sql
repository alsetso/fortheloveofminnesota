-- Add mention_type_id column to posts table for direct categorization
-- This allows posts to have a primary category in addition to indirect categorization through mentions

-- ============================================================================
-- STEP 1: Add mention_type_id column if it doesn't exist
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'mention_type_id'
  ) THEN
    -- Add the column as nullable (existing posts won't have a mention_type)
    ALTER TABLE public.posts 
      ADD COLUMN mention_type_id UUID;
    
    -- Add foreign key constraint with explicit name
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_mention_type_id_fkey 
      FOREIGN KEY (mention_type_id) REFERENCES public.mention_types(id) ON DELETE SET NULL;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS posts_mention_type_id_idx
      ON public.posts (mention_type_id)
      WHERE mention_type_id IS NOT NULL;
    
    -- Add comment
    COMMENT ON COLUMN public.posts.mention_type_id IS 
      'Primary mention type/category for this post. Allows direct categorization in addition to indirect categorization through mentions.';
  END IF;
END $$;
