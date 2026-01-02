-- Add type, custom_slug, and tags columns to map table
-- type: categorization for where to place the map
-- custom_slug: custom URL slug for pro accounts
-- tags: JSONB array of emoji+text labels

-- ============================================================================
-- STEP 1: Add type column with constraints
-- ============================================================================

ALTER TABLE public.map
ADD COLUMN IF NOT EXISTS type TEXT;

-- Add check constraint for valid type values
ALTER TABLE public.map
ADD CONSTRAINT map_type_check CHECK (
  type IS NULL OR type IN (
    'user',
    'community',
    'gov',
    'professional',
    'atlas',
    'user-generated'
  )
);

-- ============================================================================
-- STEP 2: Add custom_slug column
-- ============================================================================

ALTER TABLE public.map
ADD COLUMN IF NOT EXISTS custom_slug TEXT;

-- Add unique constraint for custom_slug (only one map can have a specific slug)
-- NULL values are allowed (multiple maps can have NULL custom_slug)
CREATE UNIQUE INDEX IF NOT EXISTS idx_map_custom_slug_unique 
ON public.map(custom_slug) 
WHERE custom_slug IS NOT NULL;

-- Add check constraint for valid slug format (lowercase alphanumeric and hyphens)
ALTER TABLE public.map
ADD CONSTRAINT map_custom_slug_format CHECK (
  custom_slug IS NULL OR (
    custom_slug ~ '^[a-z0-9-]+$' 
    AND length(custom_slug) >= 3 
    AND length(custom_slug) <= 100
  )
);

-- Create index for custom_slug lookups
CREATE INDEX IF NOT EXISTS idx_map_custom_slug ON public.map(custom_slug)
WHERE custom_slug IS NOT NULL;

-- ============================================================================
-- STEP 3: Add tags column (JSONB)
-- ============================================================================

ALTER TABLE public.map
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Add check constraint to ensure tags is always an array
ALTER TABLE public.map
ADD CONSTRAINT map_tags_is_array CHECK (jsonb_typeof(tags) = 'array');

-- Create GIN index for efficient JSONB queries on tags
CREATE INDEX IF NOT EXISTS idx_map_tags ON public.map USING GIN (tags);

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON COLUMN public.map.type IS 'Categorization type for map placement: user, community, gov, professional, atlas, user-generated';
COMMENT ON COLUMN public.map.custom_slug IS 'Custom URL-friendly slug for pro accounts. Must be unique, 3-100 characters, lowercase alphanumeric and hyphens only.';
COMMENT ON COLUMN public.map.tags IS 'JSONB array of tag objects with emoji and text: [{"emoji": "🏔️", "text": "Mountains"}, ...]. Server-side managed.';


