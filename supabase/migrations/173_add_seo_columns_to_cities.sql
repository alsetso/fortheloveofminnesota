-- Add SEO columns and additional metadata to cities table
-- meta_title and meta_description allow custom SEO metadata per city
-- website_url stores the official city website URL
-- favorite marks cities as favorites for special display
-- Follows the same pattern as counties table for consistency

-- ============================================================================
-- STEP 1: Add SEO columns
-- ============================================================================

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- ============================================================================
-- STEP 2: Add website and favorite columns
-- ============================================================================

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 3: Add constraints for SEO column lengths
-- ============================================================================

-- Meta title should be <= 70 characters for optimal SEO
ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_meta_title_length;

ALTER TABLE public.cities
  ADD CONSTRAINT cities_meta_title_length 
    CHECK (meta_title IS NULL OR char_length(meta_title) <= 70);

-- Meta description should be <= 160 characters for optimal SEO
ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_meta_description_length;

ALTER TABLE public.cities
  ADD CONSTRAINT cities_meta_description_length 
    CHECK (meta_description IS NULL OR char_length(meta_description) <= 160);

-- Website URL should be a valid URL format (basic validation)
ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_website_url_format;

ALTER TABLE public.cities
  ADD CONSTRAINT cities_website_url_format 
    CHECK (website_url IS NULL OR website_url ~ '^https?://');

-- ============================================================================
-- STEP 4: Create indexes
-- ============================================================================

-- Index for favorite cities (for quick filtering)
CREATE INDEX IF NOT EXISTS cities_favorite_idx 
  ON public.cities (favorite) 
  WHERE favorite = true;

-- ============================================================================
-- STEP 5: Add comments
-- ============================================================================

COMMENT ON COLUMN public.cities.meta_title IS 'Custom SEO title for city page (max 70 characters). If not set, defaults to generated title.';
COMMENT ON COLUMN public.cities.meta_description IS 'Custom SEO meta description for city page (max 160 characters). If not set, defaults to generated description.';
COMMENT ON COLUMN public.cities.website_url IS 'Official city website URL (must start with http:// or https://)';
COMMENT ON COLUMN public.cities.favorite IS 'Whether this city is marked as a favorite for special display';








