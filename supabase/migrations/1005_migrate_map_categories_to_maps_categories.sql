-- Migrate public.map_categories → maps.categories
-- Simple migration: map_id + category name

-- ============================================================================
-- STEP 1: Ensure maps.categories has all columns
-- ============================================================================

-- Columns should already exist, but ensure they're there
ALTER TABLE maps.categories ADD COLUMN IF NOT EXISTS map_id uuid REFERENCES maps.maps(id) ON DELETE CASCADE;
ALTER TABLE maps.categories ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE maps.categories ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ============================================================================
-- STEP 2: Migrate data
-- ============================================================================

INSERT INTO maps.categories (
  id,
  map_id,
  name,
  created_at
)
SELECT 
  id,
  map_id,
  category as name, -- public.map_categories.category → maps.categories.name
  now() as created_at
FROM public.map_categories
WHERE map_id IN (SELECT id FROM maps.maps) -- Only migrate categories for maps that exist in maps.maps
ON CONFLICT (map_id, name) DO UPDATE SET
  name = EXCLUDED.name;

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
DECLARE
  public_count INTEGER;
  maps_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_count FROM public.map_categories;
  SELECT COUNT(*) INTO maps_count FROM maps.categories;
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.map_categories rows: %', public_count;
  RAISE NOTICE '  maps.categories rows: %', maps_count;
  
  IF maps_count >= public_count THEN
    RAISE NOTICE '✅ Migration successful! All rows migrated.';
  ELSE
    RAISE WARNING '⚠️  Migration incomplete. Missing % rows.', public_count - maps_count;
  END IF;
END $$;
