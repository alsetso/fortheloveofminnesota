-- ============================================================================
-- Remove is_setup_complete column from map table (rollback)
-- This removes the column if it was added by the previous migration
-- ============================================================================

-- Drop index first
DROP INDEX IF EXISTS public.idx_map_is_setup_complete;

-- Remove column
ALTER TABLE public.map
  DROP COLUMN IF EXISTS is_setup_complete;
