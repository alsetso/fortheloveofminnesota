-- Drop maps, points, and map_shares tables and all related objects
-- This removes the user maps and points sharing system

-- ============================================================================
-- STEP 1: Drop RLS policies
-- ============================================================================

-- Drop maps policies
DROP POLICY IF EXISTS "Users can view accessible maps" ON public.maps;
DROP POLICY IF EXISTS "Users can create maps" ON public.maps;
DROP POLICY IF EXISTS "Users can update own maps" ON public.maps;
DROP POLICY IF EXISTS "Users can delete own maps" ON public.maps;

-- Drop points policies
DROP POLICY IF EXISTS "Users can view accessible points" ON public.points;
DROP POLICY IF EXISTS "Users can create points on accessible maps" ON public.points;
DROP POLICY IF EXISTS "Users can update points on accessible maps" ON public.points;
DROP POLICY IF EXISTS "Users can delete points on accessible maps" ON public.points;

-- Drop map_shares policies
DROP POLICY IF EXISTS "Users can view shares for own maps" ON public.map_shares;
DROP POLICY IF EXISTS "Users can share own maps" ON public.map_shares;
DROP POLICY IF EXISTS "Users can update shares for own maps" ON public.map_shares;
DROP POLICY IF EXISTS "Users can delete shares for own maps" ON public.map_shares;

-- ============================================================================
-- STEP 2: Drop triggers
-- ============================================================================

DROP TRIGGER IF EXISTS update_maps_updated_at ON public.maps;
DROP TRIGGER IF EXISTS update_points_updated_at ON public.points;

-- ============================================================================
-- STEP 3: Drop tables (CASCADE will handle foreign keys and dependent objects)
-- ============================================================================

-- Drop in reverse dependency order
DROP TABLE IF EXISTS public.map_shares CASCADE;
DROP TABLE IF EXISTS public.points CASCADE;
DROP TABLE IF EXISTS public.maps CASCADE;

-- ============================================================================
-- STEP 4: Drop functions
-- ============================================================================

-- Drop functions that reference the tables
DROP FUNCTION IF EXISTS public.user_has_map_access(UUID, public.map_permission);
DROP FUNCTION IF EXISTS public.user_owns_map(UUID);

-- ============================================================================
-- STEP 5: Drop enum type (CASCADE will handle any remaining dependencies)
-- ============================================================================

DROP TYPE IF EXISTS public.map_permission CASCADE;

-- ============================================================================
-- STEP 6: Verification
-- ============================================================================

DO $$
DECLARE
  v_maps_exists BOOLEAN;
  v_points_exists BOOLEAN;
  v_map_shares_exists BOOLEAN;
  v_enum_exists BOOLEAN;
BEGIN
  -- Check if tables still exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'maps'
  ) INTO v_maps_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'points'
  ) INTO v_points_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'map_shares'
  ) INTO v_map_shares_exists;
  
  -- Check if enum still exists
  SELECT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typname = 'map_permission'
  ) INTO v_enum_exists;
  
  IF v_maps_exists OR v_points_exists OR v_map_shares_exists OR v_enum_exists THEN
    RAISE WARNING 'Some objects still exist: maps=%, points=%, map_shares=%, map_permission=%', 
      v_maps_exists, v_points_exists, v_map_shares_exists, v_enum_exists;
  ELSE
    RAISE NOTICE 'Migration completed successfully. All maps, points, map_shares tables and related objects have been dropped.';
  END IF;
END;
$$;




