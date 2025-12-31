-- Refresh public.people view to include new columns (district, email, phone, address)
-- Views using SELECT * don't automatically include new columns - they need to be refreshed

-- ============================================================================
-- Refresh the public.people view
-- ============================================================================

-- Drop the existing view first to avoid column order conflicts
DROP VIEW IF EXISTS public.people;

-- Recreate the view with all columns in the correct order
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
  created_at
FROM civic.people;

-- Ensure permissions are still in place
GRANT SELECT ON public.people TO anon, authenticated;
GRANT ALL ON public.people TO service_role;

