-- Drop map schema and points_of_interest table
-- Part of cleanup: removing map schema and points of interest functionality
-- WARNING: This is destructive and will remove all map schema data

-- ============================================================================
-- STEP 1: Drop trigger function if it exists
-- ============================================================================

DROP FUNCTION IF EXISTS map.sync_points_of_interest_coordinates() CASCADE;

-- ============================================================================
-- STEP 2: Drop points_of_interest table (cascades to indexes, triggers, policies)
-- ============================================================================

DROP TABLE IF EXISTS map.points_of_interest CASCADE;

-- ============================================================================
-- STEP 3: Drop map schema (cascades to all objects in schema)
-- ============================================================================

DROP SCHEMA IF EXISTS map CASCADE;

-- ============================================================================
-- STEP 4: Verify cleanup
-- ============================================================================

DO $$
BEGIN
  -- Check if schema still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata 
    WHERE schema_name = 'map'
  ) THEN
    RAISE EXCEPTION 'map schema still exists after drop';
  END IF;
  
  -- Check if table still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'map' AND table_name = 'points_of_interest'
  ) THEN
    RAISE EXCEPTION 'map.points_of_interest table still exists after drop';
  END IF;
  
  -- Check if function still exists
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'sync_points_of_interest_coordinates'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'map')
  ) THEN
    RAISE EXCEPTION 'map.sync_points_of_interest_coordinates function still exists after drop';
  END IF;
  
  RAISE NOTICE 'Successfully dropped map schema and points_of_interest table';
END;
$$;
