-- Add 'light' and 'dark' options to map_style enum

-- ============================================================================
-- STEP 1: Alter map_style enum to add new values
-- ============================================================================

ALTER TYPE public.map_style ADD VALUE IF NOT EXISTS 'light';
ALTER TYPE public.map_style ADD VALUE IF NOT EXISTS 'dark';

-- ============================================================================
-- STEP 2: Update comment
-- ============================================================================

COMMENT ON TYPE public.map_style IS 'Map style options: street, satellite, light, dark';

