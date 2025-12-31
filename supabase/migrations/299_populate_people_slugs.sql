-- Populate slug column for existing people records
-- Creates URL-friendly slugs from names

-- ============================================================================
-- STEP 1: Generate slugs from names
-- ============================================================================

UPDATE civic.people
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'), -- Remove special chars
      '\s+', '-', 'g' -- Replace spaces with hyphens
    ),
    '^-|-$', '', 'g' -- Remove leading/trailing hyphens
  )
)
WHERE slug IS NULL;

-- ============================================================================
-- STEP 2: Handle duplicates by appending numbers
-- ============================================================================

-- This will handle any duplicate slugs that might occur
DO $$
DECLARE
  person_record RECORD;
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER;
BEGIN
  FOR person_record IN 
    SELECT id, name FROM civic.people WHERE slug IS NULL OR slug IN (
      SELECT slug FROM civic.people GROUP BY slug HAVING COUNT(*) > 1
    )
  LOOP
    base_slug := LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(person_record.name, '[^a-zA-Z0-9\s]', '', 'g'),
          '\s+', '-', 'g'
        ),
        '^-|-$', '', 'g'
      )
    );
    
    final_slug := base_slug;
    counter := 1;
    
    -- If slug exists, append number
    WHILE EXISTS (SELECT 1 FROM civic.people WHERE slug = final_slug AND id != person_record.id) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    
    UPDATE civic.people SET slug = final_slug WHERE id = person_record.id;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Add unique constraint
-- ============================================================================

-- Remove any remaining NULLs (shouldn't happen, but just in case)
UPDATE civic.people SET slug = 'person-' || id::text WHERE slug IS NULL;

-- Add unique constraint
ALTER TABLE civic.people 
  ADD CONSTRAINT people_slug_unique UNIQUE (slug);

