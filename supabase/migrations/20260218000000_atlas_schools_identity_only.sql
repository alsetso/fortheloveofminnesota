-- FINAL IDENTITY ONLY: atlas.schools
-- Applied in stages via execute_sql (trigger/FK conflicts required staging).
-- This file documents the final state for version control.

-- 1. Enum
DO $$ BEGIN
  CREATE TYPE atlas.school_type_enum AS ENUM ('public', 'charter', 'private', 'alternative');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. atlas.districts
CREATE TABLE IF NOT EXISTS atlas.districts (
  id uuid PRIMARY KEY,
  name text NOT NULL
);
INSERT INTO atlas.districts (id, name)
SELECT id, name FROM layers.school_districts
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 3. atlas.cities
CREATE TABLE IF NOT EXISTS atlas.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);
INSERT INTO atlas.cities (id, name)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Unknown')
ON CONFLICT (id) DO NOTHING;

-- 4–5. Lookup tables
CREATE TABLE IF NOT EXISTS atlas.attendance_areas (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS atlas.media (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

-- 5b. Junction table for building ↔ school
CREATE TABLE IF NOT EXISTS atlas.school_building_links (
  school_id uuid NOT NULL REFERENCES atlas.schools(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES civic.school_buildings(id) ON DELETE CASCADE,
  PRIMARY KEY (building_id)
);
INSERT INTO atlas.school_building_links (school_id, building_id)
SELECT id, school_building_id FROM atlas.schools WHERE school_building_id IS NOT NULL
ON CONFLICT (building_id) DO NOTHING;

-- 6. New columns
ALTER TABLE atlas.schools
  ADD COLUMN IF NOT EXISTS grade_low smallint,
  ADD COLUMN IF NOT EXISTS grade_high smallint,
  ADD COLUMN IF NOT EXISTS district_id uuid,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS logo_media_id uuid,
  ADD COLUMN IF NOT EXISTS nces_id text,
  ADD COLUMN IF NOT EXISTS mde_id text,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Drop old FK on city_id (pointed to layers.cities_and_towns)
ALTER TABLE atlas.schools DROP CONSTRAINT IF EXISTS schools_city_id_fkey;
ALTER TABLE atlas.schools DROP CONSTRAINT IF EXISTS schools_created_by_fkey;
ALTER TABLE atlas.schools DROP CONSTRAINT IF EXISTS schools_school_building_id_fkey;
ALTER TABLE atlas.schools DROP CONSTRAINT IF EXISTS schools_school_district_id_fkey;

-- Backfills
UPDATE atlas.schools SET district_id = school_district_id WHERE school_district_id IS NOT NULL;
UPDATE atlas.schools SET city_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE city_id IS NULL;
UPDATE atlas.schools SET
  grade_low = CASE WHEN grades_served ~ '^K-' THEN 0 WHEN grades_served ~ '^\d' THEN (regexp_match(grades_served, '^(\d+)'))[1]::smallint ELSE NULL END,
  grade_high = CASE WHEN grades_served ~ '-\d+$' THEN (regexp_match(grades_served, '-(\d+)$'))[1]::smallint ELSE NULL END
WHERE grades_served IS NOT NULL AND grades_served <> '';
UPDATE atlas.schools SET phone = COALESCE(school_phone, phone) WHERE school_phone IS NOT NULL;
UPDATE atlas.schools SET website_url = COALESCE(school_website, website_url) WHERE school_website IS NOT NULL;

-- 8. Drop legacy columns
ALTER TABLE atlas.schools
  DROP COLUMN IF EXISTS description, DROP COLUMN IF EXISTS meta_title, DROP COLUMN IF EXISTS meta_description,
  DROP COLUMN IF EXISTS favorite, DROP COLUMN IF EXISTS view_count, DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS district, DROP COLUMN IF EXISTS metadata, DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS local_favorite_count, DROP COLUMN IF EXISTS neighborhood_affiliation,
  DROP COLUMN IF EXISTS historical_significance, DROP COLUMN IF EXISTS local_story,
  DROP COLUMN IF EXISTS related_places, DROP COLUMN IF EXISTS nearby_amenities,
  DROP COLUMN IF EXISTS community_notes, DROP COLUMN IF EXISTS local_tips,
  DROP COLUMN IF EXISTS photo_gallery, DROP COLUMN IF EXISTS reviews_count,
  DROP COLUMN IF EXISTS community_rating, DROP COLUMN IF EXISTS parking_info,
  DROP COLUMN IF EXISTS accessibility_features, DROP COLUMN IF EXISTS contact_methods,
  DROP COLUMN IF EXISTS seasonal_availability, DROP COLUMN IF EXISTS winter_features,
  DROP COLUMN IF EXISTS summer_features, DROP COLUMN IF EXISTS weather_dependent,
  DROP COLUMN IF EXISTS pet_friendly, DROP COLUMN IF EXISTS family_friendly,
  DROP COLUMN IF EXISTS upcoming_events, DROP COLUMN IF EXISTS regular_activities,
  DROP COLUMN IF EXISTS peak_times, DROP COLUMN IF EXISTS hours_seasonal,
  DROP COLUMN IF EXISTS walk_ins_welcome, DROP COLUMN IF EXISTS cost_range,
  DROP COLUMN IF EXISTS reservation_required, DROP COLUMN IF EXISTS school_building_id,
  DROP COLUMN IF EXISTS school_district_id, DROP COLUMN IF EXISTS grades_served,
  DROP COLUMN IF EXISTS teacher_count, DROP COLUMN IF EXISTS student_teacher_ratio,
  DROP COLUMN IF EXISTS free_reduced_pct, DROP COLUMN IF EXISTS ell_pct,
  DROP COLUMN IF EXISTS math_proficiency_pct, DROP COLUMN IF EXISTS reading_proficiency_pct,
  DROP COLUMN IF EXISTS graduation_rate, DROP COLUMN IF EXISTS school_phone,
  DROP COLUMN IF EXISTS school_website;

-- 9. school_type enum swap
DROP TRIGGER IF EXISTS auto_link_schools_to_layers ON atlas.schools;
ALTER TABLE atlas.schools ADD COLUMN IF NOT EXISTS school_type_new atlas.school_type_enum;
UPDATE atlas.schools SET school_type_new = 'public'::atlas.school_type_enum;
ALTER TABLE atlas.schools DROP COLUMN IF EXISTS school_type;
ALTER TABLE atlas.schools RENAME COLUMN school_type_new TO school_type;
ALTER TABLE atlas.schools ALTER COLUMN school_type SET NOT NULL;
ALTER TABLE atlas.schools ALTER COLUMN school_type SET DEFAULT 'public'::atlas.school_type_enum;

-- 10. verified_by uuid FK
ALTER TABLE atlas.schools DROP COLUMN IF EXISTS verified_by;
ALTER TABLE atlas.schools ADD COLUMN verified_by uuid REFERENCES auth.users(id);

-- 11. attendance_area_id cleanup
UPDATE atlas.schools SET attendance_area_id = NULL;

-- 12. Type tightening (trigger must be dropped first)
ALTER TABLE atlas.schools ALTER COLUMN year_established TYPE smallint USING year_established::smallint;
ALTER TABLE atlas.schools ALTER COLUMN lat TYPE numeric(9,6) USING lat::numeric(9,6);
ALTER TABLE atlas.schools ALTER COLUMN lng TYPE numeric(9,6) USING lng::numeric(9,6);

-- Recreate trigger
CREATE TRIGGER auto_link_schools_to_layers
  AFTER INSERT OR UPDATE OF lat, lng ON atlas.schools
  FOR EACH ROW WHEN (NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL)
  EXECUTE FUNCTION atlas.auto_link_to_layers();

-- 13. FKs and constraints
DO $$ BEGIN ALTER TABLE atlas.schools ADD CONSTRAINT fk_schools_district FOREIGN KEY (district_id) REFERENCES atlas.districts(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE atlas.schools ADD CONSTRAINT fk_schools_city FOREIGN KEY (city_id) REFERENCES atlas.cities(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE atlas.schools ADD CONSTRAINT fk_schools_attendance_area FOREIGN KEY (attendance_area_id) REFERENCES atlas.attendance_areas(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE atlas.schools ADD CONSTRAINT fk_schools_logo_media FOREIGN KEY (logo_media_id) REFERENCES atlas.media(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE atlas.schools ALTER COLUMN district_id SET NOT NULL;
ALTER TABLE atlas.schools ALTER COLUMN city_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_atlas_schools_slug ON atlas.schools(slug);
COMMENT ON TABLE atlas.schools IS 'Identity-only school records';

-- 14. RLS for new tables
ALTER TABLE atlas.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read districts" ON atlas.districts FOR SELECT USING (true);
ALTER TABLE atlas.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cities" ON atlas.cities FOR SELECT USING (true);
ALTER TABLE atlas.attendance_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read attendance_areas" ON atlas.attendance_areas FOR SELECT USING (true);
ALTER TABLE atlas.media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read media" ON atlas.media FOR SELECT USING (true);
ALTER TABLE atlas.school_building_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read school_building_links" ON atlas.school_building_links FOR SELECT USING (true);

-- 15. Updated RPCs
DROP FUNCTION IF EXISTS public.get_nearby_schools(uuid, numeric, integer);
CREATE FUNCTION public.get_nearby_schools(
  p_school_id uuid, p_radius_miles numeric DEFAULT 10, p_limit integer DEFAULT 5
) RETURNS TABLE(
  id uuid, name text, slug text, district_name text, address text,
  lat numeric, lng numeric, school_type text, enrollment integer,
  grade_low smallint, grade_high smallint, distance_miles numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, atlas AS $$
  WITH origin AS (SELECT s.lat AS o_lat, s.lng AS o_lng FROM atlas.schools s WHERE s.id = p_school_id)
  SELECT s.id, s.name, s.slug, d.name, s.address, s.lat, s.lng, s.school_type::text, s.enrollment,
    s.grade_low, s.grade_high,
    ROUND((3959*acos(LEAST(1,GREATEST(-1,cos(radians(o.o_lat))*cos(radians(s.lat))*cos(radians(s.lng)-radians(o.o_lng))+sin(radians(o.o_lat))*sin(radians(s.lat))))))::numeric,1)
  FROM atlas.schools s JOIN origin o ON true LEFT JOIN atlas.districts d ON d.id = s.district_id
  WHERE s.id != p_school_id AND s.lat IS NOT NULL AND s.lng IS NOT NULL AND s.is_active = true
  ORDER BY distance_miles LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_atlas_school_by_building_id(p_building_id uuid)
RETURNS TABLE(id uuid, name text, slug text) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, atlas AS $$
  SELECT s.id, s.name, s.slug FROM atlas.schools s
  JOIN atlas.school_building_links l ON l.school_id = s.id AND l.building_id = p_building_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_schools(uuid, numeric, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_atlas_school_by_building_id(uuid) TO anon, authenticated;
