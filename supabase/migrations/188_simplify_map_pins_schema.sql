-- Simplify map_pins schema
-- Remove label, color, icon, emoji columns
-- Keep only description as the single text field

-- ============================================================================
-- STEP 1: Drop columns
-- ============================================================================

ALTER TABLE public.map_pins
  DROP COLUMN IF EXISTS label,
  DROP COLUMN IF EXISTS color,
  DROP COLUMN IF EXISTS icon,
  DROP COLUMN IF EXISTS emoji;

-- ============================================================================
-- STEP 2: Update comments
-- ============================================================================

COMMENT ON COLUMN public.map_pins.description IS 'Text content for the pin (single source of text)';





