-- Fix PostgREST schema cache issues after migration 421
-- This migration checks for broken references and forces schema cache refresh

-- ============================================================================
-- STEP 1: Verify all functions are valid
-- ============================================================================

-- Check if extract_mention_id_from_url function exists and is valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname = 'extract_mention_id_from_url'
  ) THEN
    RAISE EXCEPTION 'Function extract_mention_id_from_url is missing';
  END IF;
END $$;

-- Check if extract_profile_username_from_url function exists and is valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname = 'extract_profile_username_from_url'
  ) THEN
    RAISE EXCEPTION 'Function extract_profile_username_from_url is missing';
  END IF;
END $$;

-- Check if record_url_visit function exists and is valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname = 'record_url_visit'
  ) THEN
    RAISE EXCEPTION 'Function record_url_visit is missing';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Verify tables exist
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'url_visits'
  ) THEN
    RAISE EXCEPTION 'Table url_visits is missing';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts'
  ) THEN
    RAISE EXCEPTION 'Table accounts is missing';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'mentions'
  ) THEN
    RAISE EXCEPTION 'Table mentions is missing';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Verify foreign key constraints
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.url_visits'::regclass
    AND confrelid = 'public.accounts'::regclass
    AND contype = 'f'
  ) THEN
    RAISE WARNING 'Foreign key from url_visits to accounts is missing';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Verify analytics schema is dropped
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata 
    WHERE schema_name = 'analytics'
  ) THEN
    RAISE WARNING 'Analytics schema still exists - may need manual cleanup';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Force PostgREST schema cache refresh
-- ============================================================================

-- Multiple refresh attempts to ensure it takes
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- STEP 6: Verify accounts table is accessible
-- ============================================================================

-- Test query to ensure accounts table is accessible
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.accounts
  LIMIT 1;
  
  RAISE NOTICE 'Accounts table is accessible. Row count check passed.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Accounts table query failed: %', SQLERRM;
END $$;

-- ============================================================================
-- STEP 7: Verify url_visits table is accessible
-- ============================================================================

-- Test query to ensure url_visits table is accessible
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.url_visits
  LIMIT 1;
  
  RAISE NOTICE 'url_visits table is accessible. Row count check passed.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'url_visits table query failed: %', SQLERRM;
END $$;

COMMENT ON MIGRATION IS 'Diagnostic migration to verify schema integrity and force PostgREST cache refresh after analytics consolidation';
