-- Completely drop the atlas schema and all public schema references to atlas
-- This script removes all atlas tables, views, functions, types, and the schema itself
-- WARNING: This is destructive and will remove all atlas data
--
-- IMPORTANT: All civic schema is preserved:
--   - civic.jurisdictions: FK constraints dropped, but city_id/county_id columns kept
--   - civic.county_boundaries: FK constraint dropped, but county_id column kept
--   - civic.all_jurisdictions: Updated to remove atlas references (only manual jurisdictions)
--   - civic.get_city_jurisdiction: Dropped (referenced atlas.cities)

-- ============================================================================
-- STEP 1: Drop foreign key constraints from other schemas that reference atlas
-- ============================================================================

-- Drop FK from public.accounts.city_id -> atlas.cities
ALTER TABLE public.accounts 
  DROP CONSTRAINT IF EXISTS accounts_city_id_fkey;

-- Drop FK from public.mentions.city_id -> atlas.cities
ALTER TABLE public.mentions 
  DROP CONSTRAINT IF EXISTS mentions_city_id_fkey;

-- Drop FK from public.pins (atlas_metadata references, but stored as JSONB, no FK)
-- Note: pins table stores city_id/county_id as UUID without FK constraints

-- Drop FK from civic.jurisdictions.city_id -> atlas.cities
ALTER TABLE civic.jurisdictions 
  DROP CONSTRAINT IF EXISTS jurisdictions_city_id_fkey;

-- Drop FK from civic.jurisdictions.county_id -> atlas.counties
ALTER TABLE civic.jurisdictions 
  DROP CONSTRAINT IF EXISTS jurisdictions_county_id_fkey;

-- Drop FK from civic.county_boundaries.county_id -> atlas.counties
-- Note: Keeping county_id column in civic.county_boundaries (just removing FK constraint)
ALTER TABLE civic.county_boundaries 
  DROP CONSTRAINT IF EXISTS county_boundaries_county_id_fkey;

-- ============================================================================
-- STEP 2: Drop public schema views that reference atlas
-- ============================================================================

DROP VIEW IF EXISTS public.atlas_entities CASCADE;
DROP VIEW IF EXISTS public.cities CASCADE;
DROP VIEW IF EXISTS public.counties CASCADE;
DROP VIEW IF EXISTS public.neighborhoods CASCADE;
DROP VIEW IF EXISTS public.lakes CASCADE;
DROP VIEW IF EXISTS public.parks CASCADE;
DROP VIEW IF EXISTS public.schools CASCADE;
DROP VIEW IF EXISTS public.watertowers CASCADE;
DROP VIEW IF EXISTS public.cemeteries CASCADE;
DROP VIEW IF EXISTS public.golf_courses CASCADE;
DROP VIEW IF EXISTS public.hospitals CASCADE;
DROP VIEW IF EXISTS public.airports CASCADE;
DROP VIEW IF EXISTS public.churches CASCADE;
DROP VIEW IF EXISTS public.municipals CASCADE;
DROP VIEW IF EXISTS public.roads CASCADE;
DROP VIEW IF EXISTS public.radio_and_news CASCADE;

-- ============================================================================
-- STEP 3: Update civic schema views to remove atlas references
-- ============================================================================

-- Update civic.all_jurisdictions view to remove atlas references
-- Keep only manual jurisdictions (no atlas cities/counties)
CREATE OR REPLACE VIEW civic.all_jurisdictions AS
SELECT 
  j.id,
  j.name,
  j.slug,
  j.type,
  j.parent_id,
  j.city_id,
  j.county_id,
  'jurisdiction' AS source
FROM civic.jurisdictions j;

-- Grant permissions on updated view
GRANT SELECT ON civic.all_jurisdictions TO anon, authenticated, service_role;

-- Update public.all_jurisdictions view if it exists
CREATE OR REPLACE VIEW public.all_jurisdictions AS 
SELECT * FROM civic.all_jurisdictions;
GRANT SELECT ON public.all_jurisdictions TO anon, authenticated, service_role;

-- ============================================================================
-- STEP 4: Drop all atlas schema functions
-- ============================================================================

DROP FUNCTION IF EXISTS atlas.insert_atlas_entity(TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS atlas.generate_mn_id() CASCADE;
DROP FUNCTION IF EXISTS atlas.resolve_mn_id(CHAR) CASCADE;
DROP FUNCTION IF EXISTS atlas.update_atlas_types_updated_at() CASCADE;
DROP FUNCTION IF EXISTS atlas.update_contracts_updated_at() CASCADE;

-- Drop any trigger functions that might exist
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'atlas' 
    AND routine_type = 'FUNCTION'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS atlas.%I CASCADE', r.routine_name);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Drop all atlas schema views
-- ============================================================================

DROP VIEW IF EXISTS atlas.atlas_entities CASCADE;
DROP VIEW IF EXISTS atlas.all_entities CASCADE;

-- Drop any remaining views
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT table_name 
    FROM information_schema.views 
    WHERE table_schema = 'atlas'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS atlas.%I CASCADE', r.table_name);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 6: Drop all atlas schema tables (in dependency order)
-- ============================================================================

-- Drop POI tables first (they reference cities/counties)
DROP TABLE IF EXISTS atlas.neighborhoods CASCADE;
DROP TABLE IF EXISTS atlas.schools CASCADE;
DROP TABLE IF EXISTS atlas.parks CASCADE;
DROP TABLE IF EXISTS atlas.lakes CASCADE;
DROP TABLE IF EXISTS atlas.watertowers CASCADE;
DROP TABLE IF EXISTS atlas.cemeteries CASCADE;
DROP TABLE IF EXISTS atlas.golf_courses CASCADE;
DROP TABLE IF EXISTS atlas.hospitals CASCADE;
DROP TABLE IF EXISTS atlas.airports CASCADE;
DROP TABLE IF EXISTS atlas.churches CASCADE;
DROP TABLE IF EXISTS atlas.municipals CASCADE;
DROP TABLE IF EXISTS atlas.roads CASCADE;
DROP TABLE IF EXISTS atlas.radio_and_news CASCADE;
DROP TABLE IF EXISTS atlas.contracts CASCADE;

-- Drop configuration tables
DROP TABLE IF EXISTS atlas.atlas_types CASCADE;

-- Drop core reference tables (cities references counties)
DROP TABLE IF EXISTS atlas.cities CASCADE;
DROP TABLE IF EXISTS atlas.counties CASCADE;
DROP TABLE IF EXISTS atlas.city_counties CASCADE;

-- Drop any remaining tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'atlas' 
    AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS atlas.%I CASCADE', r.table_name);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 7: Drop all atlas schema types and enums
-- ============================================================================

DROP TYPE IF EXISTS atlas.atlas_type_status CASCADE;

-- Drop any remaining types
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT typname 
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'atlas'
    AND t.typtype = 'e' -- enum types
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS atlas.%I CASCADE', r.typname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 8: Drop all RLS policies on atlas schema (if any remain)
-- ============================================================================

-- Policies are automatically dropped with tables, but clean up any orphaned ones
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'atlas'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON atlas.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 9: Revoke all grants on atlas schema
-- ============================================================================

REVOKE ALL ON SCHEMA atlas FROM authenticated;
REVOKE ALL ON SCHEMA atlas FROM anon;
REVOKE ALL ON SCHEMA atlas FROM public;

-- ============================================================================
-- STEP 10: Drop the atlas schema itself
-- ============================================================================

DROP SCHEMA IF EXISTS atlas CASCADE;

-- ============================================================================
-- STEP 11: Clean up public schema functions that reference atlas
-- ============================================================================

-- Drop functions that reference atlas schema
DROP FUNCTION IF EXISTS public.find_county_by_name(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_city_counties(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.insert_city(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.update_city(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.delete_city(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.insert_county(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.update_county(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.delete_county(uuid) CASCADE;

-- Drop trigger functions for public views
DROP FUNCTION IF EXISTS public.cities_insert_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.cities_update_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.cities_delete_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.counties_insert_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.counties_update_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.counties_delete_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.city_counties_insert_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.city_counties_update_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.city_counties_delete_trigger() CASCADE;

-- Drop triggers on public views
DROP TRIGGER IF EXISTS cities_instead_of_insert ON public.cities;
DROP TRIGGER IF EXISTS cities_instead_of_update ON public.cities;
DROP TRIGGER IF EXISTS cities_instead_of_delete ON public.cities;
DROP TRIGGER IF EXISTS counties_instead_of_insert ON public.counties;
DROP TRIGGER IF EXISTS counties_instead_of_update ON public.counties;
DROP TRIGGER IF EXISTS counties_instead_of_delete ON public.counties;
DROP TRIGGER IF EXISTS city_counties_instead_of_insert ON public.city_counties;
DROP TRIGGER IF EXISTS city_counties_instead_of_update ON public.city_counties;
DROP TRIGGER IF EXISTS city_counties_instead_of_delete ON public.city_counties;

-- Drop any remaining views that might reference atlas
DROP VIEW IF EXISTS public.v_cities_missing_counties CASCADE;

-- ============================================================================
-- STEP 12: Update civic schema functions that reference atlas
-- ============================================================================

-- Drop civic.get_city_jurisdiction function (references atlas.cities)
DROP FUNCTION IF EXISTS civic.get_city_jurisdiction(UUID) CASCADE;

-- ============================================================================
-- VERIFICATION: Confirm atlas schema is completely removed
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'atlas') THEN
    RAISE EXCEPTION 'Atlas schema still exists after drop operation';
  ELSE
    RAISE NOTICE 'Atlas schema successfully dropped';
  END IF;
END $$;
