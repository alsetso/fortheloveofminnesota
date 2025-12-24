-- Add SEO columns and additional metadata to counties table
-- meta_title and meta_description allow custom SEO metadata per county
-- website_url stores the official county website URL
-- other_urls stores additional URLs as JSON array
-- favorite marks counties as favorites for special display

-- ============================================================================
-- STEP 1: Add SEO columns
-- ============================================================================

ALTER TABLE public.counties
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- ============================================================================
-- STEP 2: Add website and URL columns
-- ============================================================================

ALTER TABLE public.counties
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS other_urls JSONB,
  ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 3: Add constraints for SEO column lengths
-- ============================================================================

-- Meta title should be <= 70 characters for optimal SEO
ALTER TABLE public.counties
  DROP CONSTRAINT IF EXISTS counties_meta_title_length;

ALTER TABLE public.counties
  ADD CONSTRAINT counties_meta_title_length 
    CHECK (meta_title IS NULL OR char_length(meta_title) <= 70);

-- Meta description should be <= 160 characters for optimal SEO
ALTER TABLE public.counties
  DROP CONSTRAINT IF EXISTS counties_meta_description_length;

ALTER TABLE public.counties
  ADD CONSTRAINT counties_meta_description_length 
    CHECK (meta_description IS NULL OR char_length(meta_description) <= 160);

-- Website URL should be a valid URL format (basic validation)
ALTER TABLE public.counties
  DROP CONSTRAINT IF EXISTS counties_website_url_format;

ALTER TABLE public.counties
  ADD CONSTRAINT counties_website_url_format 
    CHECK (website_url IS NULL OR website_url ~ '^https?://');

-- ============================================================================
-- STEP 4: Create indexes
-- ============================================================================

-- Index for favorite counties (for quick filtering)
CREATE INDEX IF NOT EXISTS counties_favorite_idx 
  ON public.counties (favorite) 
  WHERE favorite = true;

-- GIN index for other_urls JSONB queries
CREATE INDEX IF NOT EXISTS counties_other_urls_idx 
  ON public.counties USING GIN (other_urls) 
  WHERE other_urls IS NOT NULL;

-- ============================================================================
-- STEP 5: Add comments
-- ============================================================================

COMMENT ON COLUMN public.counties.meta_title IS 'Custom SEO title for county page (max 70 characters). If not set, defaults to generated title.';
COMMENT ON COLUMN public.counties.meta_description IS 'Custom SEO meta description for county page (max 160 characters). If not set, defaults to generated description.';
COMMENT ON COLUMN public.counties.website_url IS 'Official county website URL (must start with http:// or https://)';
COMMENT ON COLUMN public.counties.other_urls IS 'Additional URLs as JSON array. Format: ["url1", "url2", ...]';
COMMENT ON COLUMN public.counties.favorite IS 'Whether this county is marked as a favorite for special display';









