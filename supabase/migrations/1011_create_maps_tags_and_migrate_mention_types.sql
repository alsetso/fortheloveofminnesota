-- Create maps.tags table from public.mention_types and migrate all data
-- Add tag_id column to maps.pins and migrate relationships

-- ============================================================================
-- STEP 1: Create maps.tags table with same structure as public.mention_types
-- ============================================================================

CREATE TABLE IF NOT EXISTS maps.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Constraints
  CONSTRAINT tags_emoji_unique UNIQUE (emoji),
  CONSTRAINT tags_name_unique UNIQUE (name)
);

-- ============================================================================
-- STEP 2: Migrate all data from public.mention_types to maps.tags
-- ============================================================================

INSERT INTO maps.tags (
  id,
  emoji,
  name,
  created_at,
  updated_at,
  is_active
)
SELECT 
  id,
  emoji,
  name,
  created_at,
  updated_at,
  is_active
FROM public.mention_types
ON CONFLICT (id) DO UPDATE SET
  emoji = EXCLUDED.emoji,
  name = EXCLUDED.name,
  updated_at = EXCLUDED.updated_at,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 3: Create indexes on maps.tags
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tags_name ON maps.tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_emoji ON maps.tags(emoji);
CREATE INDEX IF NOT EXISTS idx_tags_is_active ON maps.tags(is_active) WHERE is_active = true;

-- ============================================================================
-- STEP 4: Add tag_id column to maps.pins
-- ============================================================================

ALTER TABLE maps.pins 
  ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES maps.tags(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maps_pins_tag_id ON maps.pins(tag_id) WHERE tag_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Migrate tag relationships from public.map_pins to maps.pins
-- ============================================================================

-- Update maps.pins.tag_id based on public.map_pins.mention_type_id
UPDATE maps.pins mp
SET tag_id = mp_old.mention_type_id
FROM public.map_pins mp_old
WHERE mp.id = mp_old.id
  AND mp_old.mention_type_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM maps.tags WHERE id = mp_old.mention_type_id);

-- ============================================================================
-- STEP 6: Enable RLS on maps.tags
-- ============================================================================

ALTER TABLE maps.tags ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read tags (public data)
CREATE POLICY "tags_select"
  ON maps.tags
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Authenticated users can insert tags (for admin use)
CREATE POLICY "tags_insert"
  ON maps.tags
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update tags
CREATE POLICY "tags_update"
  ON maps.tags
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete tags
CREATE POLICY "tags_delete"
  ON maps.tags
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- STEP 7: Grant permissions on maps.tags
-- ============================================================================

GRANT SELECT ON maps.tags TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON maps.tags TO authenticated;

-- ============================================================================
-- STEP 8: Create updated_at trigger on maps.tags
-- ============================================================================

CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON maps.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 9: Add comments
-- ============================================================================

COMMENT ON TABLE maps.tags IS 'Tag categories for map pins. Migrated from public.mention_types. Used to categorize pins on maps.';
COMMENT ON COLUMN maps.tags.id IS 'Unique tag ID (UUID)';
COMMENT ON COLUMN maps.tags.emoji IS 'Emoji icon for this tag (unique)';
COMMENT ON COLUMN maps.tags.name IS 'Display name for this tag (unique)';
COMMENT ON COLUMN maps.tags.is_active IS 'Whether this tag is active and available for use';
COMMENT ON COLUMN maps.pins.tag_id IS 'Reference to maps.tags table for categorizing pins. Migrated from public.map_pins.mention_type_id.';

-- ============================================================================
-- STEP 10: Verification
-- ============================================================================

DO $$
DECLARE
  mention_types_count INTEGER;
  tags_count INTEGER;
  map_pins_with_tags INTEGER;
  maps_pins_with_tags INTEGER;
BEGIN
  SELECT COUNT(*) INTO mention_types_count FROM public.mention_types;
  SELECT COUNT(*) INTO tags_count FROM maps.tags;
  SELECT COUNT(*) INTO map_pins_with_tags FROM public.map_pins WHERE mention_type_id IS NOT NULL;
  SELECT COUNT(*) INTO maps_pins_with_tags FROM maps.pins WHERE tag_id IS NOT NULL;
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.mention_types rows: %', mention_types_count;
  RAISE NOTICE '  maps.tags rows: %', tags_count;
  RAISE NOTICE '  public.map_pins with mention_type_id: %', map_pins_with_tags;
  RAISE NOTICE '  maps.pins with tag_id: %', maps_pins_with_tags;
  
  IF tags_count = mention_types_count THEN
    RAISE NOTICE '✅ Tags migration successful! All mention_types migrated.';
  ELSE
    RAISE WARNING '⚠️  Tags migration incomplete. Expected %, got %.', mention_types_count, tags_count;
  END IF;
  
  IF maps_pins_with_tags >= map_pins_with_tags THEN
    RAISE NOTICE '✅ Tag relationships migrated successfully!';
  ELSE
    RAISE WARNING '⚠️  Tag relationships incomplete. Expected %, got %.', map_pins_with_tags, maps_pins_with_tags;
  END IF;
END $$;
