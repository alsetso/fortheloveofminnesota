-- Verification script for atlas_entities view
-- Run this in your Supabase SQL editor or via psql

-- Check if the view exists in atlas schema
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'atlas'
  AND table_name = 'atlas_entities';

-- Check if the public view exists
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'atlas_entities';

-- Check view definition
SELECT 
  view_definition
FROM information_schema.views
WHERE table_schema = 'atlas'
  AND table_name = 'atlas_entities';

-- Count entities by table
SELECT 
  table_name,
  COUNT(*) as entity_count
FROM atlas.atlas_entities
GROUP BY table_name
ORDER BY table_name;

-- Sample data from each table
SELECT 
  table_name,
  name,
  lat,
  lng,
  entity_type
FROM atlas.atlas_entities
ORDER BY table_name, name
LIMIT 20;
