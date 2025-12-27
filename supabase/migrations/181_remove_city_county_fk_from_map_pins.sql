-- Remove foreign key constraints from city_id and county_id in map_pins table
-- Keep the columns and indexes, but remove the referential integrity constraints
-- This allows storing city/county IDs without enforcing database-level relationships

-- ============================================================================
-- STEP 1: Drop foreign key constraints
-- ============================================================================

-- Drop city_id foreign key constraint
ALTER TABLE public.map_pins
  DROP CONSTRAINT IF EXISTS map_pins_city_id_fkey;

-- Drop county_id foreign key constraint
ALTER TABLE public.map_pins
  DROP CONSTRAINT IF EXISTS map_pins_county_id_fkey;

-- ============================================================================
-- STEP 2: Update comments to reflect the change
-- ============================================================================

COMMENT ON COLUMN public.map_pins.city_id IS 'Optional reference to a city (stored as UUID, no foreign key constraint)';
COMMENT ON COLUMN public.map_pins.county_id IS 'Optional reference to a county (stored as UUID, no foreign key constraint)';








