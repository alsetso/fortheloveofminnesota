-- Make posts.title nullable since posts don't require titles
-- This matches the API and UI where title is optional

-- ============================================================================
-- STEP 1: Drop the NOT NULL constraint on posts.title
-- ============================================================================

ALTER TABLE public.posts
  ALTER COLUMN title DROP NOT NULL;

-- ============================================================================
-- STEP 2: Update the constraint to allow empty strings or null
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_title_length;

-- Create new constraint that allows null or non-empty strings
ALTER TABLE public.posts
  ADD CONSTRAINT posts_title_length CHECK (
    title IS NULL OR (char_length(title) >= 1 AND char_length(title) <= 200)
  );

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.posts.title IS 'Optional title for the post. If null, post has no title (content-only post).';

-- ============================================================================
-- STEP 4: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
