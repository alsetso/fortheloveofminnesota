-- Add title column to civic.people table
-- For storing titles like "Senate", "House of Representatives", etc.

-- ============================================================================
-- STEP 1: Add title column
-- ============================================================================

ALTER TABLE civic.people
  ADD COLUMN IF NOT EXISTS title TEXT;

-- ============================================================================
-- STEP 2: Create index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_people_title ON civic.people(title) WHERE title IS NOT NULL;

-- ============================================================================
-- STEP 3: Update public view
-- ============================================================================

-- Drop the existing view first to avoid column order conflicts
DROP VIEW IF EXISTS public.people;

-- Recreate the view with all columns including title and building_id
CREATE VIEW public.people AS 
SELECT 
  id,
  name,
  slug,
  party,
  photo_url,
  district,
  email,
  phone,
  address,
  title,
  building_id,
  created_at
FROM civic.people;

-- Ensure permissions are still in place
GRANT SELECT ON public.people TO anon, authenticated;
GRANT ALL ON public.people TO service_role;

