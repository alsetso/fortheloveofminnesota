-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add hide_location column to pins table
-- 
-- Allows users to hide exact coordinates and use city coordinates instead
-- When hide_location is true, pin uses city_id coordinates for privacy
-- ═══════════════════════════════════════════════════════════════════════════

-- Add hide_location column (defaults to false for existing pins)
ALTER TABLE public.pins
ADD COLUMN IF NOT EXISTS hide_location BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster queries filtering by hide_location
CREATE INDEX IF NOT EXISTS idx_pins_hide_location 
ON public.pins (hide_location)
WHERE hide_location = true;

-- Add comment for documentation
COMMENT ON COLUMN public.pins.hide_location IS 'When true, pin uses city coordinates instead of exact coordinates. Requires city_id to be set.';
