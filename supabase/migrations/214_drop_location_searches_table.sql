-- Drop location_searches table and all associated objects
-- This migration removes the location_searches table, its indexes, policies, and grants

-- ============================================================================
-- STEP 1: Drop RLS policies on location_searches
-- ============================================================================

DROP POLICY IF EXISTS "authenticated_users_insert_own_searches" ON public.location_searches;
DROP POLICY IF EXISTS "authenticated_users_view_own_searches" ON public.location_searches;
DROP POLICY IF EXISTS "Users can insert own location searches" ON public.location_searches;
DROP POLICY IF EXISTS "Users can view own location searches" ON public.location_searches;

-- ============================================================================
-- STEP 2: Drop indexes on location_searches
-- ============================================================================

DROP INDEX IF EXISTS public.idx_location_searches_user_id;
DROP INDEX IF EXISTS public.idx_location_searches_profile_id;
DROP INDEX IF EXISTS public.idx_location_searches_account_id;
DROP INDEX IF EXISTS public.idx_location_searches_created_at;
DROP INDEX IF EXISTS public.idx_location_searches_user_created;
DROP INDEX IF EXISTS public.idx_location_searches_user_account_created;
DROP INDEX IF EXISTS public.idx_location_searches_user_profile_created;

-- ============================================================================
-- STEP 3: Revoke grants on location_searches
-- ============================================================================

REVOKE ALL ON public.location_searches FROM authenticated;
REVOKE ALL ON public.location_searches FROM anon;
REVOKE ALL ON public.location_searches FROM public;

-- ============================================================================
-- STEP 4: Drop foreign key constraints (if any exist)
-- ============================================================================

-- Drop any foreign key constraints that might exist
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname, conrelid::regclass
    FROM pg_constraint
    WHERE conrelid = 'public.location_searches'::regclass
    AND contype = 'f'
  ) LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I CASCADE', r.conrelid, r.conname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Drop any triggers on location_searches
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
    AND event_object_table = 'location_searches'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.location_searches CASCADE', r.trigger_name);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 6: Drop the location_searches table
-- ============================================================================

DROP TABLE IF EXISTS public.location_searches CASCADE;

-- ============================================================================
-- STEP 7: Drop any functions that reference location_searches (if any)
-- ============================================================================

-- Check for functions that might reference location_searches in their body
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT proname, oid, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND (
      prosrc LIKE '%location_searches%'
      OR prosrc LIKE '%location_searches%'
    )
  ) LOOP
    -- Only drop if it's not a system function and references location_searches
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
    EXCEPTION
      WHEN OTHERS THEN
        -- Skip if function doesn't exist or can't be dropped
        NULL;
    END;
  END LOOP;
END $$;

