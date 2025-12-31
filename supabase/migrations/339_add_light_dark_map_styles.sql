-- Add light and dark map styles to map_style enum

-- ============================================================================
-- STEP 1: Alter map_style enum to include light and dark
-- ============================================================================

ALTER TYPE public.map_style ADD VALUE IF NOT EXISTS 'light';
ALTER TYPE public.map_style ADD VALUE IF NOT EXISTS 'dark';

-- ============================================================================
-- STEP 2: Update comment
-- ============================================================================

COMMENT ON TYPE public.map_style IS 'Map style: street, satellite, light, or dark';

