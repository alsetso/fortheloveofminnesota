-- Update website URLs and mark cities as favorites
-- This migration updates the specified cities with their official website URLs
-- and marks them as favorites for special display

-- ============================================================================
-- STEP 1: Update Minneapolis
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.minneapolismn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Minneapolis';

-- ============================================================================
-- STEP 2: Update Saint Paul
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.stpaul.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Saint Paul';

-- ============================================================================
-- STEP 3: Update Rochester
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.rochestermn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Rochester';

-- ============================================================================
-- STEP 4: Update Bloomington
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.bloomingtonmn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Bloomington';

-- ============================================================================
-- STEP 5: Update Duluth
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://duluthmn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Duluth';

-- ============================================================================
-- STEP 6: Update Brooklyn Park
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.brooklynpark.org/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Brooklyn Park';

-- ============================================================================
-- STEP 7: Update Woodbury
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.woodburymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Woodbury';

-- ============================================================================
-- STEP 8: Update Plymouth
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.plymouthmn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Plymouth';

-- ============================================================================
-- STEP 9: Update Lakeville
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://lakevillemn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Lakeville';

-- ============================================================================
-- STEP 10: Update Blaine
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.ci.blaine.mn.us/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Blaine';

-- ============================================================================
-- STEP 11: Update Maple Grove
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.maplegrovemn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Maple Grove';

-- ============================================================================
-- STEP 12: Update Eagan
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.cityofeagan.com/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Eagan';

-- ============================================================================
-- STEP 13: Update St. Cloud
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.ci.stcloud.mn.us/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'St. Cloud';

-- ============================================================================
-- STEP 14: Update Burnsville
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.burnsvillemn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Burnsville';

-- ============================================================================
-- STEP 15: Update Eden Prairie
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.edenprairie.org/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Eden Prairie';

-- ============================================================================
-- STEP 16: Update Coon Rapids
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.coonrapidsmn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Coon Rapids';

-- ============================================================================
-- STEP 17: Update Apple Valley
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.applevalleymn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Apple Valley';

-- ============================================================================
-- STEP 18: Update Edina
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.edinamn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Edina';

-- ============================================================================
-- STEP 19: Update Minnetonka
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.minnetonkamn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Minnetonka';

-- ============================================================================
-- STEP 20: Update St. Louis Park
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.stlouispark.org/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'St. Louis Park';

-- ============================================================================
-- STEP 21: Update Shakopee
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.shakopeemn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Shakopee';

-- ============================================================================
-- STEP 22: Update Maplewood
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.maplewoodmn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Maplewood';

-- ============================================================================
-- STEP 23: Update Cottage Grove
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.cottagegrovemn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Cottage Grove';

-- ============================================================================
-- STEP 24: Update Richfield
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.richfieldmn.gov/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Richfield';

-- ============================================================================
-- STEP 25: Update Roseville
-- ============================================================================

UPDATE public.cities
SET 
  website_url = 'https://www.cityofroseville.com/',
  favorite = true,
  updated_at = NOW()
WHERE name = 'Roseville';

-- ============================================================================
-- Verification query (commented out - uncomment to verify)
-- ============================================================================

-- SELECT name, website_url, favorite 
-- FROM public.cities
-- WHERE favorite = true
-- ORDER BY name;








