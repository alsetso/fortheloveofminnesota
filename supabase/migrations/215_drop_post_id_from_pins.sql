-- Drop post_id column from pins table
-- This removes the optional reference to posts table

-- ============================================================================
-- STEP 1: Drop the index on post_id
-- ============================================================================

DROP INDEX IF EXISTS public.idx_pins_post_id;

-- ============================================================================
-- STEP 2: Drop foreign key constraint on post_id (if it exists)
-- ============================================================================

ALTER TABLE public.pins
  DROP CONSTRAINT IF EXISTS pins_post_id_fkey;

-- ============================================================================
-- STEP 3: Drop the post_id column
-- ============================================================================

ALTER TABLE public.pins
  DROP COLUMN IF EXISTS post_id;



