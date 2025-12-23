-- Create unified view for all atlas entities
-- Minimal view with only: id, name, city_id, emoji, lat, lng
-- This view combines all atlas tables into a single queryable structure
-- with a common schema that can be filtered by table_name

-- ============================================================================
-- STEP 1: Create unified atlas_entities view
-- ============================================================================

CREATE OR REPLACE VIEW atlas.atlas_entities AS
SELECT 
  id,
  name,
  city_id,
  '🏘️' AS emoji,
  lat,
  lng,
  'neighborhoods' AS table_name
FROM atlas.neighborhoods
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '🎓' AS emoji,
  lat,
  lng,
  'schools' AS table_name
FROM atlas.schools
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '🌳' AS emoji,
  lat,
  lng,
  'parks' AS table_name
FROM atlas.parks
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '💧' AS emoji,
  lat,
  lng,
  'lakes' AS table_name
FROM atlas.lakes
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '🗼' AS emoji,
  lat,
  lng,
  'watertowers' AS table_name
FROM atlas.watertowers
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '🪦' AS emoji,
  lat,
  lng,
  'cemeteries' AS table_name
FROM atlas.cemeteries
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '⛳' AS emoji,
  lat,
  lng,
  'golf_courses' AS table_name
FROM atlas.golf_courses
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '🏥' AS emoji,
  lat,
  lng,
  'hospitals' AS table_name
FROM atlas.hospitals
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '✈️' AS emoji,
  lat,
  lng,
  'airports' AS table_name
FROM atlas.airports
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '⛪' AS emoji,
  lat,
  lng,
  'churches' AS table_name
FROM atlas.churches
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '🏛️' AS emoji,
  lat,
  lng,
  'municipals' AS table_name
FROM atlas.municipals
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '🛣️' AS emoji,
  lat,
  lng,
  'roads' AS table_name
FROM atlas.roads
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
  id,
  name,
  city_id,
  '📻' AS emoji,
  lat,
  lng,
  'radio_and_news' AS table_name
FROM atlas.radio_and_news
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================================================
-- STEP 2: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.atlas_entities TO authenticated, anon;

-- ============================================================================
-- STEP 3: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.atlas_entities AS
SELECT * FROM atlas.atlas_entities;

GRANT SELECT ON public.atlas_entities TO authenticated, anon;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON VIEW atlas.atlas_entities IS 'Unified view combining all atlas entity tables (neighborhoods, schools, parks, lakes, watertowers, cemeteries, golf_courses, hospitals, airports, churches, municipals, roads, radio_and_news) into a single queryable structure. Filter by table_name to get specific entity types. Only includes entities with lat/lng coordinates.';
COMMENT ON COLUMN atlas.atlas_entities.table_name IS 'Source table name: neighborhoods, schools, parks, lakes, watertowers, cemeteries, golf_courses, hospitals, airports, churches, municipals, roads, radio_and_news';
COMMENT ON COLUMN atlas.atlas_entities.emoji IS 'Emoji icon for the entity type: 🏘️ neighborhoods, 🎓 schools, 🌳 parks, 💧 lakes, 🗼 watertowers, 🪦 cemeteries, ⛳ golf_courses, 🏥 hospitals, ✈️ airports, ⛪ churches, 🏛️ municipals, 🛣️ roads, 📻 radio_and_news';
