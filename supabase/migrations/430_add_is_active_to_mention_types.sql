-- Add is_active column to mention_types table
-- Allows admins to control public visibility of mention types
-- Only admins can edit this column (enforced by existing RLS policies)

-- ============================================================================
-- STEP 1: Add is_active column to mention_types table
-- ============================================================================

ALTER TABLE public.mention_types
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Index for filtering active mention types
CREATE INDEX IF NOT EXISTS idx_mention_types_is_active 
  ON public.mention_types(is_active) 
  WHERE is_active = true;

-- ============================================================================
-- STEP 2: Add comment
-- ============================================================================

COMMENT ON COLUMN public.mention_types.is_active IS 
  'Whether this mention type is publicly visible. Only admins can update this column. Defaults to true.';
