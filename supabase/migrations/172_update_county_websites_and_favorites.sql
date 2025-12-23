-- Update website URLs and mark counties as favorites
-- This migration updates the specified counties with their official website URLs
-- and marks them as favorites for special display

-- ============================================================================
-- STEP 1: Update Hennepin County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.hennepin.us/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Hennepin%County%' OR name = 'Hennepin County';

-- ============================================================================
-- STEP 2: Update Ramsey County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.ramseycounty.us/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Ramsey%County%' OR name = 'Ramsey County';

-- ============================================================================
-- STEP 3: Update Dakota County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.co.dakota.mn.us/Pages/default.aspx',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Dakota%County%' OR name = 'Dakota County';

-- ============================================================================
-- STEP 4: Update Anoka County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.anokacountymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Anoka%County%' OR name = 'Anoka County';

-- ============================================================================
-- STEP 5: Update Washington County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.washingtoncountymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Washington%County%' OR name = 'Washington County';

-- ============================================================================
-- STEP 6: Update Scott County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.scottcountymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Scott%County%' OR name = 'Scott County';

-- ============================================================================
-- STEP 7: Update Wright County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.wrightcountymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Wright%County%' OR name = 'Wright County';

-- ============================================================================
-- STEP 8: Update Carver County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.carvercountymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Carver%County%' OR name = 'Carver County';

-- ============================================================================
-- STEP 9: Update Sherburne County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.sherburnecounty-mn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Sherburne%County%' OR name = 'Sherburne County';

-- ============================================================================
-- STEP 10: Update St. Louis County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.stlouiscountymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%St. Louis%County%' 
   OR name ILIKE '%Saint Louis%County%'
   OR name = 'St. Louis County'
   OR name = 'Saint Louis County';

-- ============================================================================
-- STEP 11: Update Chisago County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.chisagocountymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Chisago%County%' OR name = 'Chisago County';

-- ============================================================================
-- STEP 12: Update Isanti County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.co.isanti.mn.us/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Isanti%County%' OR name = 'Isanti County';

-- ============================================================================
-- STEP 13: Update Rice County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.co.rice.mn.us/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Rice%County%' OR name = 'Rice County';

-- ============================================================================
-- STEP 14: Update Goodhue County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://goodhuecountymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Goodhue%County%' OR name = 'Goodhue County';

-- ============================================================================
-- STEP 15: Update Benton County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.co.benton.mn.us/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Benton%County%' OR name = 'Benton County';

-- ============================================================================
-- STEP 16: Update Stearns County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.co.stearns.mn.us/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Stearns%County%' OR name = 'Stearns County';

-- ============================================================================
-- STEP 17: Update Olmsted County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.olmstedcounty.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Olmsted%County%' OR name = 'Olmsted County';

-- ============================================================================
-- STEP 18: Update Clay County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.claycountymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Clay%County%' OR name = 'Clay County';

-- ============================================================================
-- STEP 19: Update Sibley County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.co.sibley.mn.us/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Sibley%County%' OR name = 'Sibley County';

-- ============================================================================
-- STEP 20: Update Dodge County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.co.dodge.mn.us/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Dodge%County%' OR name = 'Dodge County';

-- ============================================================================
-- STEP 21: Update Morrison County
-- ============================================================================

UPDATE public.counties
SET 
  website_url = 'https://www.co.morrison.mn.us/',
  favorite = true,
  updated_at = NOW()
WHERE name ILIKE '%Morrison%County%' OR name = 'Morrison County';

-- ============================================================================
-- VERIFICATION: Count updated counties
-- ============================================================================

-- This query can be run to verify the updates
-- SELECT name, website_url, favorite 
-- FROM public.counties 
-- WHERE favorite = true 
-- ORDER BY name;








