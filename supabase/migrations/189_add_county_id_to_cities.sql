-- Add county_id column to cities table and populate from existing county text field
-- This links cities to counties via foreign key relationship

-- ============================================================================
-- STEP 1: Add county_id column
-- ============================================================================

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS county_id UUID REFERENCES public.counties(id) ON DELETE SET NULL;

-- Create index for county_id
CREATE INDEX IF NOT EXISTS idx_cities_county_id ON public.cities(county_id) WHERE county_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Create function to find county by name (handles variations)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_county_by_name(p_county_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_county_id UUID;
  v_clean_name TEXT;
BEGIN
  -- Return NULL if input is empty
  IF p_county_name IS NULL OR TRIM(p_county_name) = '' THEN
    RETURN NULL;
  END IF;

  -- Clean the county name: remove "County" suffix, trim whitespace
  v_clean_name := TRIM(REGEXP_REPLACE(p_county_name, '\s+County$', '', 'i'));

  -- Try exact match first (with "County" suffix)
  SELECT id INTO v_county_id
  FROM public.counties
  WHERE name = v_clean_name || ' County'
  LIMIT 1;

  -- If not found, try without "County" suffix
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM public.counties
    WHERE name = v_clean_name
    LIMIT 1;
  END IF;

  -- If still not found, try case-insensitive match
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM public.counties
    WHERE LOWER(name) = LOWER(v_clean_name || ' County')
    LIMIT 1;
  END IF;

  -- If still not found, try case-insensitive without "County"
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM public.counties
    WHERE LOWER(name) = LOWER(v_clean_name)
    LIMIT 1;
  END IF;

  -- If still not found, try partial match (county name contains the search term)
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM public.counties
    WHERE LOWER(name) LIKE LOWER('%' || v_clean_name || '%')
    LIMIT 1;
  END IF;

  RETURN v_county_id;
END;
$$;

-- ============================================================================
-- STEP 3: Update cities with county_id from county text field
-- ============================================================================

-- For cities with single county (most common case)
UPDATE public.cities
SET county_id = public.find_county_by_name(TRIM(county))
WHERE county_id IS NULL
  AND county IS NOT NULL
  AND county != '';

-- For cities with multiple counties (comma-separated), use the first one
UPDATE public.cities
SET county_id = public.find_county_by_name(TRIM(SPLIT_PART(county, ',', 1)))
WHERE county_id IS NULL
  AND county IS NOT NULL
  AND county != ''
  AND county LIKE '%,%';

-- ============================================================================
-- STEP 4: Add comment
-- ============================================================================

COMMENT ON COLUMN public.cities.county_id IS 'Foreign key reference to counties table. For cities spanning multiple counties, this is set to the primary county (first county in the comma-separated list).';

-- ============================================================================
-- STEP 5: Report results (for verification)
-- ============================================================================

-- This will show in the migration output
DO $$
DECLARE
  v_total_cities INTEGER;
  v_cities_with_county_id INTEGER;
  v_cities_without_county_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_cities FROM public.cities;
  SELECT COUNT(*) INTO v_cities_with_county_id FROM public.cities WHERE county_id IS NOT NULL;
  SELECT COUNT(*) INTO v_cities_without_county_id FROM public.cities WHERE county_id IS NULL;

  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Total cities: %', v_total_cities;
  RAISE NOTICE '  Cities with county_id: %', v_cities_with_county_id;
  RAISE NOTICE '  Cities without county_id: %', v_cities_without_county_id;
END;
$$;





