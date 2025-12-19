-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add event_date column to pins table
-- 
-- Allows users to post-date pins up to 50 years in the past
-- Enables filtering map by year to show only pins from that year
-- ═══════════════════════════════════════════════════════════════════════════

-- Add event_date column (nullable, defaults to created_at for existing pins)
ALTER TABLE public.pins
ADD COLUMN IF NOT EXISTS event_date TIMESTAMP WITH TIME ZONE;

-- Set event_date to created_at for all existing pins
UPDATE public.pins
SET event_date = created_at
WHERE event_date IS NULL;

-- Add index for date range queries (used for year filtering)
-- This index supports efficient year filtering via date range queries
CREATE INDEX IF NOT EXISTS idx_pins_event_date 
ON public.pins (event_date)
WHERE event_date IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.pins.event_date IS 'Date when the event/memory happened. Can be up to 100 years in the past. Defaults to created_at if not specified.';

-- Note: Index on COALESCE expression removed due to immutability constraints
-- Year filtering will use event_date index and filter client-side for null event_date
-- Performance is acceptable since year filtering is typically combined with bbox filtering
