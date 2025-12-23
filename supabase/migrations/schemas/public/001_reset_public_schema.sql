-- Reset public schema - drops all tables, functions, types, and policies
-- WARNING: This will delete all data in the public schema

-- ============================================================================
-- STEP 1: Drop all tables in public schema (CASCADE handles dependencies)
-- Exclude system/extension tables (PostGIS, etc.)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  extension_tables TEXT[] := ARRAY[
    'spatial_ref_sys',  -- PostGIS
    'geometry_columns', -- PostGIS
    'geography_columns' -- PostGIS
  ];
BEGIN
  -- Drop all tables except extension/system tables
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename != ALL(extension_tables)
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Drop all functions in public schema (exclude extension functions)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc p
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    -- Exclude functions that belong to extensions (PostGIS, etc.)
    AND NOT EXISTS (
      SELECT 1 
      FROM pg_depend d
      JOIN pg_extension e ON d.refobjid = e.oid
      WHERE d.objid = p.oid
      AND d.deptype = 'e' -- extension dependency
    )
    -- Also exclude PostGIS functions by name pattern (st_*)
    AND NOT proname LIKE 'st_%'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Drop all types in public schema (except those used by other schemas)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT typname
    FROM pg_type
    WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND typtype = 'e' -- Only enums
  LOOP
    -- Check if type is used by other schemas before dropping
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE udt_name = r.typname 
      AND table_schema != 'public'
    ) THEN
      EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Drop all triggers in public schema
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT trigger_name, event_object_table, event_object_schema
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I CASCADE', 
      r.trigger_name, r.event_object_schema, r.event_object_table);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Drop all RLS policies in public schema
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE', 
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 6: Drop all sequences in public schema
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', r.sequence_name);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 7: Drop all views in public schema
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.table_name);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 8: Verify public schema is clean
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
  function_count INTEGER;
  type_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_tables 
  WHERE schemaname = 'public';
  
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  SELECT COUNT(*) INTO type_count
  FROM pg_type
  WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND typtype = 'e';
  
  RAISE NOTICE 'Public schema reset complete. Remaining: % tables, % functions, % enum types', 
    table_count, function_count, type_count;
END $$;


