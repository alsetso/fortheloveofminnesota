-- Drop map and map_share tables

-- ============================================================================
-- STEP 1: Drop RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view accessible maps" ON public.map;
DROP POLICY IF EXISTS "Users can create maps" ON public.map;
DROP POLICY IF EXISTS "Users can update accessible maps" ON public.map;
DROP POLICY IF EXISTS "Users can delete own maps" ON public.map;

DROP POLICY IF EXISTS "Users can view accessible shares" ON public.map_share;
DROP POLICY IF EXISTS "Users can share own maps" ON public.map_share;
DROP POLICY IF EXISTS "Users can update shares for own maps" ON public.map_share;
DROP POLICY IF EXISTS "Users can delete shares for own maps" ON public.map_share;

-- ============================================================================
-- STEP 2: Drop tables (CASCADE will handle foreign keys and dependencies)
-- ============================================================================

DROP TABLE IF EXISTS public.map_share CASCADE;
DROP TABLE IF EXISTS public.map CASCADE;

-- ============================================================================
-- STEP 3: Drop helper functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.user_owns_map(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_map_access(UUID, public.map_permission) CASCADE;

-- ============================================================================
-- STEP 4: Drop enum type (if not used elsewhere)
-- ============================================================================

DROP TYPE IF EXISTS public.map_permission CASCADE;

