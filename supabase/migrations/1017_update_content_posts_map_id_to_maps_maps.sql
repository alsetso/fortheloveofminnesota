-- Update content.posts.map_id to reference maps.maps.id instead of public.map(id)
-- This aligns content.posts with the new maps schema structure

-- ============================================================================
-- STEP 1: Drop existing foreign key constraint and index
-- ============================================================================

-- Drop the existing foreign key constraint (if it exists)
DO $$
BEGIN
  -- Drop foreign key constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'content' 
    AND table_name = 'posts' 
    AND constraint_name = 'posts_map_id_fkey'
  ) THEN
    ALTER TABLE content.posts DROP CONSTRAINT posts_map_id_fkey;
  END IF;
  
  -- Also check for alternative constraint names
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'content' 
    AND table_name = 'posts' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%map_id%'
  ) THEN
    -- Find and drop any map_id foreign key constraint
    EXECUTE (
      SELECT 'ALTER TABLE content.posts DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'content' 
      AND table_name = 'posts' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%map_id%'
      LIMIT 1
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Update map_id values to ensure they exist in maps.maps
-- ============================================================================

-- Set map_id to NULL for any posts referencing maps that don't exist in maps.maps
UPDATE content.posts
SET map_id = NULL
WHERE map_id IS NOT NULL 
  AND map_id NOT IN (SELECT id FROM maps.maps);

-- ============================================================================
-- STEP 3: Add new foreign key constraint referencing maps.maps.id
-- ============================================================================

ALTER TABLE content.posts
  ADD CONSTRAINT posts_map_id_fkey 
  FOREIGN KEY (map_id) 
  REFERENCES maps.maps(id) 
  ON DELETE SET NULL;

-- ============================================================================
-- STEP 4: Ensure indexes exist (recreate if needed)
-- ============================================================================

-- Drop existing indexes if they reference the old constraint
DROP INDEX IF EXISTS content.posts_map_id_idx;
DROP INDEX IF EXISTS content.posts_map_id_visibility_created_idx;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS posts_map_id_idx 
  ON content.posts(map_id) 
  WHERE map_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS posts_map_id_visibility_created_idx 
  ON content.posts(map_id, visibility, created_at DESC) 
  WHERE map_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Update RLS policies if they reference public.map
-- ============================================================================

-- Note: RLS policies may need to be updated separately if they reference public.map
-- This migration focuses on the foreign key constraint update

-- ============================================================================
-- STEP 6: Verification
-- ============================================================================

DO $$
DECLARE
  posts_with_map_id INTEGER;
  valid_references INTEGER;
BEGIN
  SELECT COUNT(*) INTO posts_with_map_id 
  FROM content.posts 
  WHERE map_id IS NOT NULL;
  
  SELECT COUNT(*) INTO valid_references
  FROM content.posts p
  INNER JOIN maps.maps m ON p.map_id = m.id
  WHERE p.map_id IS NOT NULL;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Posts with map_id: %', posts_with_map_id;
  RAISE NOTICE '  Valid references to maps.maps: %', valid_references;
  
  IF posts_with_map_id = valid_references THEN
    RAISE NOTICE '✅ All map_id references are valid!';
  ELSE
    RAISE WARNING '⚠️  Some map_id references may be invalid. Expected: %, Found: %', posts_with_map_id, valid_references;
  END IF;
END $$;
