-- Migrate public.map_pins_likes → maps.reactions
-- Converts likes to reactions with type='like'

-- ============================================================================
-- STEP 1: Ensure maps.reactions has all columns
-- ============================================================================

-- Columns should already exist, but ensure they're there
ALTER TABLE maps.reactions ADD COLUMN IF NOT EXISTS pin_id uuid REFERENCES maps.pins(id) ON DELETE CASCADE;
ALTER TABLE maps.reactions ADD COLUMN IF NOT EXISTS author_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE maps.reactions ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('comment', 'like', 'emoji', 'gif'));
ALTER TABLE maps.reactions ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE maps.reactions ADD COLUMN IF NOT EXISTS emoji text;
ALTER TABLE maps.reactions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Create unique constraint for one like per account per pin (if it doesn't exist)
-- This ensures we can use ON CONFLICT properly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'maps.reactions'::regclass 
    AND conname = 'reactions_unique_like_per_pin'
  ) THEN
    CREATE UNIQUE INDEX reactions_unique_like_per_pin 
      ON maps.reactions(pin_id, author_account_id) 
      WHERE type = 'like';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Migrate data - Convert likes to reactions
-- ============================================================================

INSERT INTO maps.reactions (
  id,
  pin_id,
  author_account_id,
  type,
  content,
  emoji,
  created_at
)
SELECT 
  id,
  map_pin_id as pin_id,
  account_id as author_account_id,
  'like' as type,
  NULL as content, -- Likes don't have content
  NULL as emoji,   -- Likes don't have emoji
  created_at
FROM public.map_pins_likes
WHERE map_pin_id IN (SELECT id FROM maps.pins) -- Only migrate likes for pins that exist in maps.pins
ON CONFLICT (pin_id, author_account_id) WHERE type = 'like' DO UPDATE SET
  created_at = EXCLUDED.created_at;

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
DECLARE
  public_count INTEGER;
  maps_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_count FROM public.map_pins_likes;
  SELECT COUNT(*) INTO maps_count FROM maps.reactions WHERE type = 'like';
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.map_pins_likes rows: %', public_count;
  RAISE NOTICE '  maps.reactions (type=like) rows: %', maps_count;
  
  IF maps_count >= public_count THEN
    RAISE NOTICE '✅ Migration successful! All likes migrated as reactions.';
  ELSE
    RAISE WARNING '⚠️  Migration incomplete. Missing % rows.', public_count - maps_count;
  END IF;
END $$;
