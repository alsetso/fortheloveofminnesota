-- Add cities to atlas_entities view
-- Cities should be included in the unified view with emoji 🏙️

-- ============================================================================
-- STEP 1: Update atlas_entities view to include cities
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
  NULL AS city_id, -- Cities don't have a city_id (they are cities themselves)
  '🏙️' AS emoji,
  lat,
  lng,
  'cities' AS table_name
FROM atlas.cities
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
-- STEP 2: Update public view
-- ============================================================================

CREATE OR REPLACE VIEW public.atlas_entities AS
SELECT * FROM atlas.atlas_entities;

-- ============================================================================
-- STEP 3: Update comments
-- ============================================================================

COMMENT ON VIEW atlas.atlas_entities IS 'Unified view combining all atlas entity tables (cities, neighborhoods, schools, parks, lakes, watertowers, cemeteries, golf_courses, hospitals, airports, churches, municipals, roads, radio_and_news) into a single queryable structure. Filter by table_name to get specific entity types. Only includes entities with lat/lng coordinates.';
COMMENT ON COLUMN atlas.atlas_entities.table_name IS 'Source table name: cities, neighborhoods, schools, parks, lakes, watertowers, cemeteries, golf_courses, hospitals, airports, churches, municipals, roads, radio_and_news';
COMMENT ON COLUMN atlas.atlas_entities.emoji IS 'Emoji icon for the entity type: 🏙️ cities, 🏘️ neighborhoods, 🎓 schools, 🌳 parks, 💧 lakes, 🗼 watertowers, 🪦 cemeteries, ⛳ golf_courses, 🏥 hospitals, ✈️ airports, ⛪ churches, 🏛️ municipals, 🛣️ roads, 📻 radio_and_news';


