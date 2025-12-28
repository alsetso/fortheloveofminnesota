-- Grant missing permissions for atlas schema and atlas_types table
-- This fixes the "permission denied for schema" error for service_role

-- ============================================================================
-- STEP 1: Grant USAGE on atlas schema to service_role
-- ============================================================================

GRANT USAGE ON SCHEMA atlas TO service_role;

-- ============================================================================
-- STEP 2: Grant permissions on atlas_types table
-- ============================================================================

GRANT SELECT ON atlas.atlas_types TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.atlas_types TO authenticated;
GRANT ALL ON atlas.atlas_types TO service_role;

