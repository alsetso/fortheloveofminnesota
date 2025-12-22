-- Fix unique constraints on atlas tables to be per-city instead of globally unique
-- This allows the same name/slug to exist in different cities (e.g., "Downtown" in multiple cities)

-- ============================================================================
-- STEP 1: Drop old unique constraints on slug
-- ============================================================================

-- Watertowers
ALTER TABLE atlas.watertowers DROP CONSTRAINT IF EXISTS watertowers_slug_unique;
ALTER TABLE atlas.watertowers ADD CONSTRAINT watertowers_name_city_unique UNIQUE (name, city_id);

-- Cemeteries
ALTER TABLE atlas.cemeteries DROP CONSTRAINT IF EXISTS cemeteries_slug_unique;
ALTER TABLE atlas.cemeteries ADD CONSTRAINT cemeteries_name_city_unique UNIQUE (name, city_id);

-- Golf Courses
ALTER TABLE atlas.golf_courses DROP CONSTRAINT IF EXISTS golf_courses_slug_unique;
ALTER TABLE atlas.golf_courses ADD CONSTRAINT golf_courses_name_city_unique UNIQUE (name, city_id);

-- Hospitals
ALTER TABLE atlas.hospitals DROP CONSTRAINT IF EXISTS hospitals_slug_unique;
ALTER TABLE atlas.hospitals ADD CONSTRAINT hospitals_name_city_unique UNIQUE (name, city_id);

-- Airports
ALTER TABLE atlas.airports DROP CONSTRAINT IF EXISTS airports_slug_unique;
ALTER TABLE atlas.airports ADD CONSTRAINT airports_name_city_unique UNIQUE (name, city_id);

-- Churches
ALTER TABLE atlas.churches DROP CONSTRAINT IF EXISTS churches_slug_unique;
ALTER TABLE atlas.churches ADD CONSTRAINT churches_name_city_unique UNIQUE (name, city_id);

-- Municipals
ALTER TABLE atlas.municipals DROP CONSTRAINT IF EXISTS municipals_slug_unique;
ALTER TABLE atlas.municipals ADD CONSTRAINT municipals_name_city_unique UNIQUE (name, city_id);

-- Schools (keep slug unique but add name+city constraint)
ALTER TABLE atlas.schools DROP CONSTRAINT IF EXISTS schools_slug_unique;
ALTER TABLE atlas.schools ADD CONSTRAINT schools_name_city_unique UNIQUE (name, city_id);

-- Parks (keep slug unique but add name+city constraint)
ALTER TABLE atlas.parks DROP CONSTRAINT IF EXISTS parks_slug_unique;
ALTER TABLE atlas.parks ADD CONSTRAINT parks_name_city_unique UNIQUE (name, city_id);

-- Note: Neighborhoods already has neighborhoods_name_city_unique, so we only need to drop slug uniqueness
ALTER TABLE atlas.neighborhoods DROP CONSTRAINT IF EXISTS neighborhoods_slug_unique;

-- ============================================================================
-- STEP 2: Update indexes to support per-city queries
-- ============================================================================

-- These indexes already exist and are fine:
-- idx_watertowers_city_id, idx_cemeteries_city_id, etc.
-- The name indexes can stay for search purposes, but uniqueness is now per-city

COMMENT ON CONSTRAINT watertowers_name_city_unique ON atlas.watertowers IS 'Ensures watertower names are unique per city, allowing same name in different cities';
COMMENT ON CONSTRAINT cemeteries_name_city_unique ON atlas.cemeteries IS 'Ensures cemetery names are unique per city, allowing same name in different cities';
COMMENT ON CONSTRAINT golf_courses_name_city_unique ON atlas.golf_courses IS 'Ensures golf course names are unique per city, allowing same name in different cities';
COMMENT ON CONSTRAINT hospitals_name_city_unique ON atlas.hospitals IS 'Ensures hospital names are unique per city, allowing same name in different cities';
COMMENT ON CONSTRAINT airports_name_city_unique ON atlas.airports IS 'Ensures airport names are unique per city, allowing same name in different cities';
COMMENT ON CONSTRAINT churches_name_city_unique ON atlas.churches IS 'Ensures church names are unique per city, allowing same name in different cities';
COMMENT ON CONSTRAINT municipals_name_city_unique ON atlas.municipals IS 'Ensures municipal building names are unique per city, allowing same name in different cities';
COMMENT ON CONSTRAINT schools_name_city_unique ON atlas.schools IS 'Ensures school names are unique per city, allowing same name in different cities';
COMMENT ON CONSTRAINT parks_name_city_unique ON atlas.parks IS 'Ensures park names are unique per city, allowing same name in different cities';


