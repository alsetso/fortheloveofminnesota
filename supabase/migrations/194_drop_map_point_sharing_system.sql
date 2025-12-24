-- Drop all tables, functions, and types for the map/point sharing system
-- This allows us to start fresh with a new design

-- ============================================================================
-- STEP 1: Drop RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view accessible maps" ON public.maps;
DROP POLICY IF EXISTS "Users can create maps" ON public.maps;
DROP POLICY IF EXISTS "Users can update own maps" ON public.maps;
DROP POLICY IF EXISTS "Users can delete own maps" ON public.maps;

DROP POLICY IF EXISTS "Users can view accessible points" ON public.points;
DROP POLICY IF EXISTS "Users can create points on accessible maps" ON public.points;
DROP POLICY IF EXISTS "Users can update points on accessible maps" ON public.points;
DROP POLICY IF EXISTS "Users can delete points on accessible maps" ON public.points;

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
-- STEP 3: Drop indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_maps_account_id;
DROP INDEX IF EXISTS idx_maps_created_at;

DROP INDEX IF EXISTS idx_points_map_id;
DROP INDEX IF EXISTS idx_points_account_id;
DROP INDEX IF EXISTS idx_points_lat_lng;
DROP INDEX IF EXISTS idx_points_created_at;

DROP INDEX IF EXISTS idx_map_shares_map_id;
DROP INDEX IF EXISTS idx_map_shares_account_id;
DROP INDEX IF EXISTS idx_map_shares_permission;

-- ============================================================================
-- STEP 4: Drop tables (CASCADE will handle foreign keys)
-- ============================================================================

DROP TABLE IF EXISTS public.map_shares CASCADE;
DROP TABLE IF EXISTS public.points CASCADE;
DROP TABLE IF EXISTS public.maps CASCADE;

-- ============================================================================
-- STEP 5: Drop functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.user_has_map_access(UUID, public.map_permission);
DROP FUNCTION IF EXISTS user_has_map_access(UUID);
DROP FUNCTION IF EXISTS public.user_owns_map(UUID);
DROP FUNCTION IF EXISTS user_owns_map(UUID);

-- ============================================================================
-- STEP 6: Drop enum type
-- ============================================================================

DROP TYPE IF EXISTS public.map_permission CASCADE;






