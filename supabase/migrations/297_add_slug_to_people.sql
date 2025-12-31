-- Add slug column to civic.people table for URL-friendly person pages

-- ============================================================================
-- STEP 1: Add slug column
-- ============================================================================

ALTER TABLE civic.people
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- ============================================================================
-- STEP 2: Create index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_people_slug ON civic.people(slug) WHERE slug IS NOT NULL;

-- ============================================================================
-- STEP 3: Add unique constraint (after data migration if needed)
-- ============================================================================

-- Note: If you have existing data, you'll need to populate slugs first
-- Then uncomment this:
-- ALTER TABLE civic.people ADD CONSTRAINT people_slug_unique UNIQUE (slug);

-- ============================================================================
-- STEP 4: Update public view
-- ============================================================================

-- The public view will automatically include the new column
-- No explicit update needed as it uses SELECT *

