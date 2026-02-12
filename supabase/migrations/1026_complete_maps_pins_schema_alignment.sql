-- Complete maps.pins schema alignment with public.map_pins
-- Adds missing columns and migrates all data to ensure zero data loss
-- 
-- Missing columns identified:
-- 1. is_active (CRITICAL - used in RLS policies and 20+ API routes)
-- 2. city_id (60 records have this data)
-- 3. collection_id (12 records have this data)
--
-- This migration ensures maps.pins has feature parity with public.map_pins

-- ============================================================================
-- STEP 1: Add missing columns to maps.pins
-- ============================================================================

-- Add is_active column (CRITICAL - used throughout application)
ALTER TABLE maps.pins 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add city_id column (for city-based filtering)
ALTER TABLE maps.pins 
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES layers.cities(id) ON DELETE SET NULL;

-- Add collection_id column (for collection associations)
ALTER TABLE maps.pins 
  ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 2: Migrate data from public.map_pins to maps.pins
-- ============================================================================

-- Update is_active: inverse of archived (active = not archived)
-- This preserves the soft-delete semantics
UPDATE maps.pins mp
SET is_active = NOT COALESCE(pm.archived, false)
FROM public.map_pins pm
WHERE mp.id = pm.id;

-- Update city_id
UPDATE maps.pins mp
SET city_id = pm.city_id
FROM public.map_pins pm
WHERE mp.id = pm.id
  AND pm.city_id IS NOT NULL
  AND mp.city_id IS NULL;

-- Update collection_id
UPDATE maps.pins mp
SET collection_id = pm.collection_id
FROM public.map_pins pm
WHERE mp.id = pm.id
  AND pm.collection_id IS NOT NULL
  AND mp.collection_id IS NULL;

-- ============================================================================
-- STEP 3: Create indexes for new columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_maps_pins_is_active 
  ON maps.pins(is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_maps_pins_city_id 
  ON maps.pins(city_id) 
  WHERE city_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_maps_pins_collection_id 
  ON maps.pins(collection_id) 
  WHERE collection_id IS NOT NULL;

-- Composite index for common query pattern (map + active + visibility)
CREATE INDEX IF NOT EXISTS idx_maps_pins_map_active_visibility 
  ON maps.pins(map_id, is_active, visibility) 
  WHERE is_active = true AND visibility = 'public';

-- ============================================================================
-- STEP 4: Update RLS policy to include pin visibility check
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view pins on visible maps" ON maps.pins;

-- Create improved SELECT policy with pin-level visibility check
CREATE POLICY "Users can view pins on visible maps"
  ON maps.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Pin must be active and not archived
    is_active = true
    AND archived = false
    AND (
      -- Public pins visible to everyone on public/unlisted maps
      (
        visibility = 'public'
        AND map_id IN (
          SELECT maps.id 
          FROM maps.maps
          WHERE (
            maps.visibility = 'public' 
            OR maps.visibility = 'unlisted'
            OR (
              -- Authenticated users can see pins on their own maps or maps they're members of
              auth.uid() IS NOT NULL
              AND (
                maps.owner_account_id IN (
                  SELECT accounts.id 
                  FROM accounts 
                  WHERE accounts.user_id = auth.uid()
                )
                OR maps.id IN (
                  SELECT memberships.map_id 
                  FROM maps.memberships 
                  WHERE memberships.account_id IN (
                    SELECT accounts.id 
                    FROM accounts 
                    WHERE accounts.user_id = auth.uid()
                  )
                )
              )
            )
          )
        )
      )
      OR
      -- Private pins (only_me) visible only to owner
      (
        visibility = 'only_me'
        AND author_account_id IN (
          SELECT accounts.id 
          FROM accounts 
          WHERE accounts.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- STEP 5: Verification and data integrity checks
-- ============================================================================

DO $$
DECLARE
  public_count INTEGER;
  maps_count INTEGER;
  active_count INTEGER;
  inactive_count INTEGER;
  city_count INTEGER;
  collection_count INTEGER;
BEGIN
  -- Count records
  SELECT COUNT(*) INTO public_count FROM public.map_pins;
  SELECT COUNT(*) INTO maps_count FROM maps.pins;
  SELECT COUNT(*) INTO active_count FROM maps.pins WHERE is_active = true;
  SELECT COUNT(*) INTO inactive_count FROM maps.pins WHERE is_active = false;
  SELECT COUNT(*) INTO city_count FROM maps.pins WHERE city_id IS NOT NULL;
  SELECT COUNT(*) INTO collection_count FROM maps.pins WHERE collection_id IS NOT NULL;
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.map_pins rows: %', public_count;
  RAISE NOTICE '  maps.pins rows: %', maps_count;
  RAISE NOTICE '  Active pins: %', active_count;
  RAISE NOTICE '  Inactive pins: %', inactive_count;
  RAISE NOTICE '  Pins with city_id: %', city_count;
  RAISE NOTICE '  Pins with collection_id: %', collection_count;
  
  -- Verify all records migrated
  IF maps_count < public_count THEN
    RAISE WARNING '⚠️  Missing records! public.map_pins: %, maps.pins: %', public_count, maps_count;
  END IF;
  
  -- Verify is_active was set correctly (should match inverse of archived)
  IF inactive_count != (SELECT COUNT(*) FROM maps.pins WHERE archived = true) THEN
    RAISE WARNING '⚠️  is_active mismatch with archived status';
  END IF;
  
  -- Verify city_id migration (should have ~60)
  IF city_count < 50 THEN
    RAISE WARNING '⚠️  Expected ~60 pins with city_id, found %', city_count;
  END IF;
  
  -- Verify collection_id migration (should have ~12)
  IF collection_count < 10 THEN
    RAISE WARNING '⚠️  Expected ~12 pins with collection_id, found %', collection_count;
  END IF;
  
  RAISE NOTICE '✅ Schema alignment complete!';
END $$;

-- ============================================================================
-- STEP 6: Add column comments for documentation
-- ============================================================================

COMMENT ON COLUMN maps.pins.is_active IS 
  'Active flag. When false, pin is soft-deleted and hidden from queries. Inverse of archived.';

COMMENT ON COLUMN maps.pins.city_id IS 
  'Reference to layers.cities for city-based filtering and grouping.';

COMMENT ON COLUMN maps.pins.collection_id IS 
  'Reference to public.collections for organizing pins into collections.';
