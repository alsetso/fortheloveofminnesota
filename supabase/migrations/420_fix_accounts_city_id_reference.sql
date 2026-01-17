-- Fix all broken atlas schema references after atlas schema drop
-- PGRST002 error: PostgREST can't build schema cache due to broken FK references
-- This migration ensures ALL atlas references are removed from ALL tables

-- ============================================================================
-- STEP 1: Drop ALL FK constraints that reference atlas schema from ALL tables
-- ============================================================================

-- This fixes PostgREST schema cache issues by removing all broken FK references
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 
      conrelid::regclass AS table_name,
      conname AS constraint_name
    FROM pg_constraint
    WHERE contype = 'f'  -- Foreign key constraints
    AND confrelid::regclass::text LIKE 'atlas.%'  -- References atlas schema
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
      RAISE NOTICE 'Dropped FK constraint % from table %', r.constraint_name, r.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to drop constraint % from table %: %', r.constraint_name, r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Ensure city_id column exists without FK constraint
-- ============================================================================

-- Column should already exist, but ensure it's just UUID without FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'city_id'
  ) THEN
    ALTER TABLE public.accounts 
      ADD COLUMN city_id UUID;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Verify no broken references remain in ANY table
-- ============================================================================

DO $$
DECLARE
  broken_refs INTEGER;
  broken_tables TEXT;
BEGIN
  SELECT COUNT(*), string_agg(DISTINCT conrelid::regclass::text, ', ')
  INTO broken_refs, broken_tables
  FROM pg_constraint c
  WHERE c.contype = 'f'
  AND c.confrelid::regclass::text LIKE 'atlas.%';
  
  IF broken_refs > 0 THEN
    RAISE EXCEPTION 'Found % broken FK references to atlas schema in tables: %', broken_refs, broken_tables;
  ELSE
    RAISE NOTICE 'Verified: No broken FK references to atlas schema found';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add comments to clarify columns are now just UUIDs (no FK)
-- ============================================================================

-- Fix accounts.city_id comment
COMMENT ON COLUMN public.accounts.city_id IS 
  'City identifier (UUID). Foreign key constraint removed after atlas schema drop.';

-- Fix civic.county_boundaries.county_id comment if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'civic' 
    AND table_name = 'county_boundaries' 
    AND column_name = 'county_id'
  ) THEN
    COMMENT ON COLUMN civic.county_boundaries.county_id IS 
      'County identifier (UUID). Foreign key constraint removed after atlas schema drop.';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Drop any remaining views/functions that reference atlas schema
-- ============================================================================

-- Drop any views that might still reference atlas (should be done by 416, but double-check)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT schemaname, viewname
    FROM pg_views
    WHERE definition LIKE '%atlas.%'
    AND schemaname IN ('public', 'civic')
  LOOP
    BEGIN
      EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', r.schemaname, r.viewname);
      RAISE NOTICE 'Dropped view % from schema %', r.viewname, r.schemaname;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to drop view % from schema %: %', r.viewname, r.schemaname, SQLERRM;
    END;
  END LOOP;
END $$;

-- Drop any functions that reference atlas (should be done by 416, but double-check)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT n.nspname AS schema_name, p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'civic')
    AND pg_get_functiondef(p.oid) LIKE '%atlas.%'
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.schema_name, r.function_name, r.args);
      RAISE NOTICE 'Dropped function % from schema %', r.function_name, r.schema_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to drop function % from schema %: %', r.function_name, r.schema_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 6: Force PostgREST schema cache refresh (if running locally)
-- ============================================================================

-- Note: In Supabase cloud, PostgREST will auto-refresh within a few minutes
-- In local dev, you may need to restart the Supabase stack
-- This NOTIFY can help trigger a refresh in some setups
NOTIFY pgrst, 'reload schema';
