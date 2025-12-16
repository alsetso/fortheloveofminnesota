-- Add emoji column to map_pins table
-- Allows users to add emoji to their pins for visual customization

-- ============================================================================
-- STEP 1: Add emoji column
-- ============================================================================

ALTER TABLE public.map_pins
  ADD COLUMN IF NOT EXISTS emoji TEXT;

-- ============================================================================
-- STEP 2: Add comment
-- ============================================================================

COMMENT ON COLUMN public.map_pins.emoji IS 'Emoji character(s) to display with the pin (e.g., 🏠, 📍, 🎯)';

