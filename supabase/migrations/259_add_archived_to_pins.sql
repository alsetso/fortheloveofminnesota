-- Add archived column to pins table for soft delete functionality
-- When a pin is "deleted", it's marked as archived instead of being removed

-- ============================================================================
-- STEP 1: Add archived column
-- ============================================================================

ALTER TABLE public.pins
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 2: Create index for filtering out archived pins
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pins_archived 
  ON public.pins(archived) 
  WHERE archived = false;

-- Partial index for active (non-archived) pins - most queries will use this
CREATE INDEX IF NOT EXISTS idx_pins_active 
  ON public.pins(account_id, visibility, created_at DESC) 
  WHERE archived = false;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.pins.archived IS 
  'Soft delete flag. When true, pin is archived (treated as deleted but data is preserved). Archived pins are excluded from all public queries.';

