-- Remove headshot_url column from civic.people table
-- We only use photo_url for person photos

-- ============================================================================
-- STEP 1: Drop headshot_url column
-- ============================================================================

ALTER TABLE civic.people
  DROP COLUMN IF EXISTS headshot_url;

-- ============================================================================
-- STEP 2: Refresh the public view (already done in 306, but ensure it's correct)
-- ============================================================================

CREATE OR REPLACE VIEW public.people AS 
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
  created_at
FROM civic.people;

-- Ensure permissions are still in place
GRANT SELECT ON public.people TO anon, authenticated;
GRANT ALL ON public.people TO service_role;

