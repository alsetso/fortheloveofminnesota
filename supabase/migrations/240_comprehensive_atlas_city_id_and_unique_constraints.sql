-- Comprehensive Atlas mn_id Migration
-- Introduces universal 12-character immutable identifier across all atlas tables
-- Removes restrictive uniqueness constraints, enables zero-friction entity creation
-- Creates universal resolver for mn_id-based routing

-- ============================================================================
-- STEP 1: Create mn_id generator function
-- ============================================================================

CREATE OR REPLACE FUNCTION atlas.generate_mn_id()
RETURNS CHAR(12) AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * 62 + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atlas.generate_mn_id() IS 'Generates a random 12-character Base62 identifier for atlas entities';

-- ============================================================================
-- STEP 2: Add mn_id column to all atlas tables
-- ============================================================================

-- Counties
ALTER TABLE atlas.counties 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.counties SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.counties 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Cities
ALTER TABLE atlas.cities 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.cities SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.cities 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Neighborhoods
ALTER TABLE atlas.neighborhoods 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.neighborhoods SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.neighborhoods 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Lakes (also add missing slug column)
ALTER TABLE atlas.lakes 
  ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE atlas.lakes 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

-- Backfill slugs for existing lakes (lowercase, hyphenated name)
UPDATE atlas.lakes 
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

UPDATE atlas.lakes SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.lakes 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Add index on lakes slug
CREATE INDEX IF NOT EXISTS idx_lakes_slug ON atlas.lakes(slug);

-- Parks
ALTER TABLE atlas.parks 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.parks SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.parks 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Schools
ALTER TABLE atlas.schools 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.schools SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.schools 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Watertowers
ALTER TABLE atlas.watertowers 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.watertowers SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.watertowers 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Cemeteries
ALTER TABLE atlas.cemeteries 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.cemeteries SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.cemeteries 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Golf Courses
ALTER TABLE atlas.golf_courses 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.golf_courses SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.golf_courses 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Hospitals
ALTER TABLE atlas.hospitals 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.hospitals SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.hospitals 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Airports
ALTER TABLE atlas.airports 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.airports SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.airports 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Churches
ALTER TABLE atlas.churches 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.churches SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.churches 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- Municipals
ALTER TABLE atlas.municipals 
  ADD COLUMN IF NOT EXISTS mn_id CHAR(12);

UPDATE atlas.municipals SET mn_id = atlas.generate_mn_id() WHERE mn_id IS NULL;

ALTER TABLE atlas.municipals 
  ALTER COLUMN mn_id SET NOT NULL,
  ALTER COLUMN mn_id SET DEFAULT atlas.generate_mn_id();

-- ============================================================================
-- STEP 3: Create unique indexes on mn_id
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_counties_mn_id ON atlas.counties(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_mn_id ON atlas.cities(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_neighborhoods_mn_id ON atlas.neighborhoods(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lakes_mn_id ON atlas.lakes(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parks_mn_id ON atlas.parks(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_mn_id ON atlas.schools(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watertowers_mn_id ON atlas.watertowers(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cemeteries_mn_id ON atlas.cemeteries(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_golf_courses_mn_id ON atlas.golf_courses(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_mn_id ON atlas.hospitals(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_airports_mn_id ON atlas.airports(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_churches_mn_id ON atlas.churches(mn_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_municipals_mn_id ON atlas.municipals(mn_id);

-- ============================================================================
-- STEP 4: Remove restrictive name/slug uniqueness constraints
-- Admin can now create duplicate names; mn_id distinguishes entities
-- ============================================================================

-- Parks
ALTER TABLE atlas.parks DROP CONSTRAINT IF EXISTS parks_name_city_unique;
ALTER TABLE atlas.parks DROP CONSTRAINT IF EXISTS parks_slug_unique;

-- Schools
ALTER TABLE atlas.schools DROP CONSTRAINT IF EXISTS schools_name_city_unique;
ALTER TABLE atlas.schools DROP CONSTRAINT IF EXISTS schools_slug_unique;

-- Lakes (drop ALL possible name uniqueness constraints)
ALTER TABLE atlas.lakes DROP CONSTRAINT IF EXISTS lakes_name_city_unique;
ALTER TABLE atlas.lakes DROP CONSTRAINT IF EXISTS lakes_name_key;
ALTER TABLE atlas.lakes DROP CONSTRAINT IF EXISTS lakes_name_unique;
ALTER TABLE atlas.lakes DROP CONSTRAINT IF EXISTS lakes_slug_unique;
ALTER TABLE atlas.lakes DROP CONSTRAINT IF EXISTS lakes_slug_key;
DROP INDEX IF EXISTS atlas.lakes_name_key;
DROP INDEX IF EXISTS atlas.lakes_name_unique;
DROP INDEX IF EXISTS atlas.idx_lakes_name_unique;

-- Watertowers
ALTER TABLE atlas.watertowers DROP CONSTRAINT IF EXISTS watertowers_name_city_unique;
ALTER TABLE atlas.watertowers DROP CONSTRAINT IF EXISTS watertowers_slug_unique;

-- Cemeteries
ALTER TABLE atlas.cemeteries DROP CONSTRAINT IF EXISTS cemeteries_name_city_unique;
ALTER TABLE atlas.cemeteries DROP CONSTRAINT IF EXISTS cemeteries_slug_unique;

-- Golf Courses
ALTER TABLE atlas.golf_courses DROP CONSTRAINT IF EXISTS golf_courses_name_city_unique;
ALTER TABLE atlas.golf_courses DROP CONSTRAINT IF EXISTS golf_courses_slug_unique;

-- Hospitals
ALTER TABLE atlas.hospitals DROP CONSTRAINT IF EXISTS hospitals_name_city_unique;
ALTER TABLE atlas.hospitals DROP CONSTRAINT IF EXISTS hospitals_slug_unique;

-- Airports
ALTER TABLE atlas.airports DROP CONSTRAINT IF EXISTS airports_name_city_unique;
ALTER TABLE atlas.airports DROP CONSTRAINT IF EXISTS airports_slug_unique;

-- Churches
ALTER TABLE atlas.churches DROP CONSTRAINT IF EXISTS churches_name_city_unique;
ALTER TABLE atlas.churches DROP CONSTRAINT IF EXISTS churches_slug_unique;

-- Municipals
ALTER TABLE atlas.municipals DROP CONSTRAINT IF EXISTS municipals_name_city_unique;
ALTER TABLE atlas.municipals DROP CONSTRAINT IF EXISTS municipals_slug_unique;

-- Neighborhoods
ALTER TABLE atlas.neighborhoods DROP CONSTRAINT IF EXISTS neighborhoods_name_city_unique;
ALTER TABLE atlas.neighborhoods DROP CONSTRAINT IF EXISTS neighborhoods_slug_unique;

-- ============================================================================
-- STEP 5: Create universal mn_id resolver function
-- ============================================================================

CREATE OR REPLACE FUNCTION atlas.resolve_mn_id(p_mn_id CHAR(12))
RETURNS TABLE(
  entity_type TEXT, 
  entity_id UUID, 
  slug TEXT, 
  name TEXT, 
  city_id UUID,
  mn_id CHAR(12)
) AS $$
BEGIN
  -- Cities (most common)
  RETURN QUERY 
    SELECT 'city'::TEXT, c.id, c.slug, c.name, NULL::UUID, c.mn_id 
    FROM atlas.cities c WHERE c.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Counties
  RETURN QUERY 
    SELECT 'county'::TEXT, co.id, co.slug, co.name, NULL::UUID, co.mn_id 
    FROM atlas.counties co WHERE co.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Neighborhoods
  RETURN QUERY 
    SELECT 'neighborhood'::TEXT, n.id, n.slug, n.name, n.city_id, n.mn_id 
    FROM atlas.neighborhoods n WHERE n.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Parks
  RETURN QUERY 
    SELECT 'park'::TEXT, p.id, p.slug, p.name, p.city_id, p.mn_id 
    FROM atlas.parks p WHERE p.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Schools
  RETURN QUERY 
    SELECT 'school'::TEXT, s.id, s.slug, s.name, s.city_id, s.mn_id 
    FROM atlas.schools s WHERE s.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Lakes
  RETURN QUERY 
    SELECT 'lake'::TEXT, l.id, l.slug, l.name, l.city_id, l.mn_id 
    FROM atlas.lakes l WHERE l.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Hospitals
  RETURN QUERY 
    SELECT 'hospital'::TEXT, h.id, h.slug, h.name, h.city_id, h.mn_id 
    FROM atlas.hospitals h WHERE h.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Airports
  RETURN QUERY 
    SELECT 'airport'::TEXT, a.id, a.slug, a.name, a.city_id, a.mn_id 
    FROM atlas.airports a WHERE a.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Churches
  RETURN QUERY 
    SELECT 'church'::TEXT, ch.id, ch.slug, ch.name, ch.city_id, ch.mn_id 
    FROM atlas.churches ch WHERE ch.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Cemeteries
  RETURN QUERY 
    SELECT 'cemetery'::TEXT, ce.id, ce.slug, ce.name, ce.city_id, ce.mn_id 
    FROM atlas.cemeteries ce WHERE ce.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Golf Courses
  RETURN QUERY 
    SELECT 'golf_course'::TEXT, g.id, g.slug, g.name, g.city_id, g.mn_id 
    FROM atlas.golf_courses g WHERE g.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Watertowers
  RETURN QUERY 
    SELECT 'watertower'::TEXT, w.id, w.slug, w.name, w.city_id, w.mn_id 
    FROM atlas.watertowers w WHERE w.mn_id = p_mn_id;
  IF FOUND THEN RETURN; END IF;
  
  -- Municipals
  RETURN QUERY 
    SELECT 'municipal'::TEXT, m.id, m.slug, m.name, m.city_id, m.mn_id 
    FROM atlas.municipals m WHERE m.mn_id = p_mn_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION atlas.resolve_mn_id(CHAR) IS 'Resolves any mn_id to its entity type, UUID, and metadata';

-- ============================================================================
-- STEP 6: Create unified atlas_entities view for universal lookups
-- ============================================================================

CREATE OR REPLACE VIEW atlas.all_entities AS
SELECT 
  mn_id, 
  id, 
  'county'::TEXT as entity_type, 
  name, 
  slug, 
  NULL::UUID as city_id, 
  NULL::UUID as county_id,
  favorite,
  view_count,
  created_at
FROM atlas.counties
UNION ALL
SELECT 
  mn_id, 
  id, 
  'city', 
  name, 
  slug, 
  NULL, 
  county_id,
  favorite,
  view_count,
  created_at
FROM atlas.cities
UNION ALL
SELECT 
  mn_id, 
  id, 
  'neighborhood', 
  name, 
  slug, 
  city_id, 
  NULL,
  favorite,
  view_count,
  created_at
FROM atlas.neighborhoods
UNION ALL
SELECT 
  mn_id, 
  id, 
  'park', 
  name, 
  slug, 
  city_id, 
  county_id,
  favorite,
  view_count,
  created_at
FROM atlas.parks
UNION ALL
SELECT 
  mn_id, 
  id, 
  'school', 
  name, 
  slug, 
  city_id, 
  NULL,
  favorite,
  view_count,
  created_at
FROM atlas.schools
UNION ALL
SELECT 
  mn_id, 
  id, 
  'lake', 
  name, 
  slug, 
  city_id, 
  NULL,
  FALSE,
  0,
  created_at
FROM atlas.lakes
UNION ALL
SELECT 
  mn_id, 
  id, 
  'hospital', 
  name, 
  slug, 
  city_id, 
  NULL,
  favorite,
  view_count,
  created_at
FROM atlas.hospitals
UNION ALL
SELECT 
  mn_id, 
  id, 
  'airport', 
  name, 
  slug, 
  city_id, 
  NULL,
  favorite,
  view_count,
  created_at
FROM atlas.airports
UNION ALL
SELECT 
  mn_id, 
  id, 
  'church', 
  name, 
  slug, 
  city_id, 
  NULL,
  favorite,
  view_count,
  created_at
FROM atlas.churches
UNION ALL
SELECT 
  mn_id, 
  id, 
  'cemetery', 
  name, 
  slug, 
  city_id, 
  NULL,
  favorite,
  view_count,
  created_at
FROM atlas.cemeteries
UNION ALL
SELECT 
  mn_id, 
  id, 
  'golf_course', 
  name, 
  slug, 
  city_id, 
  NULL,
  favorite,
  view_count,
  created_at
FROM atlas.golf_courses
UNION ALL
SELECT 
  mn_id, 
  id, 
  'watertower', 
  name, 
  slug, 
  city_id, 
  NULL,
  favorite,
  view_count,
  created_at
FROM atlas.watertowers
UNION ALL
SELECT 
  mn_id, 
  id, 
  'municipal', 
  name, 
  slug, 
  city_id, 
  NULL,
  favorite,
  view_count,
  created_at
FROM atlas.municipals;

COMMENT ON VIEW atlas.all_entities IS 'Unified view of all atlas entities for universal mn_id lookups';

-- Grant access to the view
GRANT SELECT ON atlas.all_entities TO authenticated, anon;

-- ============================================================================
-- STEP 7: Update public views to include mn_id
-- ============================================================================

-- Recreate public views to include mn_id column
CREATE OR REPLACE VIEW public.counties AS SELECT * FROM atlas.counties;
CREATE OR REPLACE VIEW public.cities AS SELECT * FROM atlas.cities;
CREATE OR REPLACE VIEW public.neighborhoods AS SELECT * FROM atlas.neighborhoods;
CREATE OR REPLACE VIEW public.lakes AS SELECT * FROM atlas.lakes;
CREATE OR REPLACE VIEW public.parks AS SELECT * FROM atlas.parks;
CREATE OR REPLACE VIEW public.schools AS SELECT * FROM atlas.schools;
CREATE OR REPLACE VIEW public.watertowers AS SELECT * FROM atlas.watertowers;
CREATE OR REPLACE VIEW public.cemeteries AS SELECT * FROM atlas.cemeteries;
CREATE OR REPLACE VIEW public.golf_courses AS SELECT * FROM atlas.golf_courses;
CREATE OR REPLACE VIEW public.hospitals AS SELECT * FROM atlas.hospitals;
CREATE OR REPLACE VIEW public.airports AS SELECT * FROM atlas.airports;
CREATE OR REPLACE VIEW public.churches AS SELECT * FROM atlas.churches;
CREATE OR REPLACE VIEW public.municipals AS SELECT * FROM atlas.municipals;

-- Create public view for all_entities
CREATE OR REPLACE VIEW public.atlas_entities AS SELECT * FROM atlas.all_entities;
GRANT SELECT ON public.atlas_entities TO authenticated, anon;

-- ============================================================================
-- STEP 8: Update insert triggers to handle mn_id
-- ============================================================================

-- Counties insert trigger
CREATE OR REPLACE FUNCTION public.counties_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.counties (
    name, population, area_sq_mi, polygon,
    meta_title, meta_description, website_url, other_urls, favorite,
    view_count, slug, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name, 
    NEW.population, 
    NEW.area_sq_mi, 
    NEW.polygon,
    NEW.meta_title, 
    NEW.meta_description, 
    NEW.website_url, 
    NEW.other_urls, 
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0), 
    NEW.slug,
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Cities insert trigger
CREATE OR REPLACE FUNCTION public.cities_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.cities (
    name, population, county, lat, lng, slug,
    meta_title, meta_description, website_url, favorite,
    view_count, boundary_lines, county_id, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name, 
    NEW.population, 
    NEW.county, 
    NEW.lat, 
    NEW.lng, 
    NEW.slug,
    NEW.meta_title, 
    NEW.meta_description, 
    NEW.website_url, 
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0), 
    NEW.boundary_lines, 
    NEW.county_id,
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Neighborhoods insert trigger
CREATE OR REPLACE FUNCTION public.neighborhoods_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.neighborhoods (
    name, slug, city_id, lat, lng, polygon,
    population, area_sq_mi, description,
    meta_title, meta_description, website_url,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.polygon,
    NEW.population,
    NEW.area_sq_mi,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Lakes insert trigger (now includes slug)
CREATE OR REPLACE FUNCTION public.lakes_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.lakes (
    name, slug, lat, lng, polygon, city_id, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    COALESCE(NEW.slug, LOWER(REGEXP_REPLACE(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))),
    NEW.lat,
    NEW.lng,
    NEW.polygon,
    NEW.city_id,
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Lakes update trigger (now includes slug)
CREATE OR REPLACE FUNCTION public.lakes_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.lakes
  SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    lat = NEW.lat,
    lng = NEW.lng,
    polygon = NEW.polygon,
    city_id = NEW.city_id,
    updated_at = NOW()
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Parks insert trigger
CREATE OR REPLACE FUNCTION public.parks_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.parks (
    name, slug, city_id, county_id, lat, lng, polygon, address,
    park_type, area_acres, amenities,
    description, meta_title, meta_description, website_url, phone, hours,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.county_id,
    NEW.lat,
    NEW.lng,
    NEW.polygon,
    NEW.address,
    NEW.park_type,
    NEW.area_acres,
    NEW.amenities,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    NEW.hours,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Schools insert trigger
CREATE OR REPLACE FUNCTION public.schools_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.schools (
    name, slug, city_id, lat, lng, polygon, address,
    school_type, is_public, district, enrollment,
    description, meta_title, meta_description, website_url, phone,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.polygon,
    NEW.address,
    NEW.school_type,
    COALESCE(NEW.is_public, true),
    NEW.district,
    NEW.enrollment,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Watertowers insert trigger
CREATE OR REPLACE FUNCTION public.watertowers_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.watertowers (
    name, slug, city_id, lat, lng, address,
    description, meta_title, meta_description,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.address,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Cemeteries insert trigger
CREATE OR REPLACE FUNCTION public.cemeteries_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.cemeteries (
    name, slug, city_id, lat, lng, address,
    description, meta_title, meta_description, website_url, phone,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.address,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Golf Courses insert trigger
CREATE OR REPLACE FUNCTION public.golf_courses_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.golf_courses (
    name, slug, city_id, lat, lng, address,
    course_type, holes,
    description, meta_title, meta_description, website_url, phone,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.address,
    NEW.course_type,
    NEW.holes,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Hospitals insert trigger
CREATE OR REPLACE FUNCTION public.hospitals_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.hospitals (
    name, slug, city_id, lat, lng, address,
    hospital_type,
    description, meta_title, meta_description, website_url, phone,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.address,
    NEW.hospital_type,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Airports insert trigger
CREATE OR REPLACE FUNCTION public.airports_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.airports (
    name, slug, city_id, lat, lng, address,
    airport_type, iata_code, icao_code,
    description, meta_title, meta_description, website_url, phone,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.address,
    NEW.airport_type,
    NEW.iata_code,
    NEW.icao_code,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Churches insert trigger
CREATE OR REPLACE FUNCTION public.churches_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.churches (
    name, slug, city_id, lat, lng, address,
    denomination, church_type,
    description, meta_title, meta_description, website_url, phone,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.address,
    NEW.denomination,
    NEW.church_type,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Municipals insert trigger
CREATE OR REPLACE FUNCTION public.municipals_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.municipals (
    name, slug, city_id, lat, lng, address,
    municipal_type,
    description, meta_title, meta_description, website_url, phone,
    favorite, view_count, mn_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.address,
    NEW.municipal_type,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 9: Add column comments
-- ============================================================================

COMMENT ON COLUMN atlas.counties.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.cities.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.neighborhoods.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.lakes.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.lakes.slug IS 'URL-friendly slug for the lake (auto-generated from name if not provided)';
COMMENT ON COLUMN atlas.parks.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.schools.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.watertowers.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.cemeteries.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.golf_courses.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.hospitals.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.airports.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.churches.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';
COMMENT ON COLUMN atlas.municipals.mn_id IS 'Immutable 12-character Base62 identifier for universal routing';

-- ============================================================================
-- STEP 10: Grant execute on resolver function
-- ============================================================================

GRANT EXECUTE ON FUNCTION atlas.generate_mn_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION atlas.resolve_mn_id(CHAR) TO authenticated, anon, service_role;

-- ============================================================================
-- STEP 11: Verification report
-- ============================================================================

DO $$
DECLARE
  v_counties_count INTEGER;
  v_cities_count INTEGER;
  v_neighborhoods_count INTEGER;
  v_lakes_count INTEGER;
  v_parks_count INTEGER;
  v_schools_count INTEGER;
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_counties_count FROM atlas.counties WHERE mn_id IS NOT NULL;
  SELECT COUNT(*) INTO v_cities_count FROM atlas.cities WHERE mn_id IS NOT NULL;
  SELECT COUNT(*) INTO v_neighborhoods_count FROM atlas.neighborhoods WHERE mn_id IS NOT NULL;
  SELECT COUNT(*) INTO v_lakes_count FROM atlas.lakes WHERE mn_id IS NOT NULL;
  SELECT COUNT(*) INTO v_parks_count FROM atlas.parks WHERE mn_id IS NOT NULL;
  SELECT COUNT(*) INTO v_schools_count FROM atlas.schools WHERE mn_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_total FROM atlas.all_entities;
  
  RAISE NOTICE 'Migration 240 completed successfully!';
  RAISE NOTICE '  Counties with mn_id: %', v_counties_count;
  RAISE NOTICE '  Cities with mn_id: %', v_cities_count;
  RAISE NOTICE '  Neighborhoods with mn_id: %', v_neighborhoods_count;
  RAISE NOTICE '  Lakes with mn_id: %', v_lakes_count;
  RAISE NOTICE '  Parks with mn_id: %', v_parks_count;
  RAISE NOTICE '  Schools with mn_id: %', v_schools_count;
  RAISE NOTICE '  Total entities in atlas.all_entities: %', v_total;
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '  - atlas.generate_mn_id() function for creating new mn_ids';
  RAISE NOTICE '  - atlas.resolve_mn_id(mn_id) function for universal lookups';
  RAISE NOTICE '  - atlas.all_entities view for unified entity access';
  RAISE NOTICE '  - Removed restrictive name/slug uniqueness constraints';
  RAISE NOTICE '  - Updated all public view insert triggers';
END;
$$;






