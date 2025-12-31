-- Drop civic schema tables and views
-- Drops in order to respect foreign key dependencies

-- ============================================================================
-- STEP 1: Drop views first
-- ============================================================================

DROP VIEW IF EXISTS civic.all_jurisdictions CASCADE;
DROP VIEW IF EXISTS public.all_jurisdictions CASCADE;

-- ============================================================================
-- STEP 2: Drop tables (in reverse dependency order)
-- ============================================================================

-- Drop tables that have foreign keys first
DROP TABLE IF EXISTS civic.terms CASCADE;
DROP TABLE IF EXISTS civic.house_of_representatives CASCADE;
DROP TABLE IF EXISTS civic.executive_branch CASCADE;
DROP TABLE IF EXISTS civic.congressional_districts CASCADE;

-- Drop tables that are referenced by other tables
DROP TABLE IF EXISTS civic.jurisdictions CASCADE;
DROP TABLE IF EXISTS civic.positions CASCADE;
DROP TABLE IF EXISTS civic.leaders CASCADE;

-- ============================================================================
-- STEP 3: Drop public schema views if they exist
-- ============================================================================

DROP VIEW IF EXISTS public.leaders CASCADE;
DROP VIEW IF EXISTS public.positions CASCADE;
DROP VIEW IF EXISTS public.jurisdictions CASCADE;
DROP VIEW IF EXISTS public.terms CASCADE;

-- ============================================================================
-- STEP 4: Drop helper functions if they exist
-- ============================================================================

DROP FUNCTION IF EXISTS civic.generate_mn_id() CASCADE;
DROP FUNCTION IF EXISTS civic.get_city_jurisdiction(UUID) CASCADE;

-- ============================================================================
-- STEP 5: Drop schema if empty (optional - comment out if you want to keep schema)
-- ============================================================================

-- DROP SCHEMA IF EXISTS civic CASCADE;

