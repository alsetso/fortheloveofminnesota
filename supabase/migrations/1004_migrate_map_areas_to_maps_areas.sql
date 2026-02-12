-- Migrate public.map_areas → maps.areas
-- Converts JSONB geometry to PostGIS Polygon geometry

-- ============================================================================
-- STEP 1: Ensure maps.areas has all columns
-- ============================================================================

-- Columns should already exist, but ensure they're there
ALTER TABLE maps.areas ADD COLUMN IF NOT EXISTS map_id uuid REFERENCES maps.maps(id) ON DELETE CASCADE;
ALTER TABLE maps.areas ADD COLUMN IF NOT EXISTS author_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE maps.areas ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE maps.areas ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE maps.areas ADD COLUMN IF NOT EXISTS geometry geometry(Polygon, 4326);
ALTER TABLE maps.areas ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE maps.areas ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add legacy column for JSONB geometry during migration
ALTER TABLE maps.areas ADD COLUMN IF NOT EXISTS geometry_jsonb jsonb;

-- ============================================================================
-- STEP 2: Migrate data - Convert JSONB to PostGIS Polygon
-- ============================================================================

INSERT INTO maps.areas (
  id,
  map_id,
  author_account_id,
  name,
  description,
  geometry,
  geometry_jsonb, -- Keep JSONB for reference
  created_at,
  updated_at
)
SELECT 
  id,
  map_id,
  (SELECT owner_account_id FROM maps.maps WHERE maps.maps.id = map_areas.map_id LIMIT 1) as author_account_id,
  name,
  description,
  -- Convert GeoJSON Polygon/MultiPolygon to PostGIS geometry
  CASE 
    WHEN geometry->>'type' = 'Polygon' THEN
      ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)::geometry(Polygon, 4326)
    WHEN geometry->>'type' = 'MultiPolygon' THEN
      -- For MultiPolygon, take the first polygon (or convert to Polygon)
      ST_SetSRID(ST_GeomFromGeoJSON(
        json_build_object(
          'type', 'Polygon',
          'coordinates', (geometry->'coordinates'->0)
        )::text
      ), 4326)::geometry(Polygon, 4326)
    ELSE NULL
  END as geometry,
  geometry as geometry_jsonb,
  created_at,
  updated_at
FROM public.map_areas
WHERE map_id IN (SELECT id FROM maps.maps) -- Only migrate areas for maps that exist in maps.maps
  AND geometry IS NOT NULL
  AND geometry->>'type' IN ('Polygon', 'MultiPolygon')
ON CONFLICT (id) DO UPDATE SET
  map_id = EXCLUDED.map_id,
  author_account_id = EXCLUDED.author_account_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  geometry = EXCLUDED.geometry,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
DECLARE
  public_count INTEGER;
  maps_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_count FROM public.map_areas;
  SELECT COUNT(*) INTO maps_count FROM maps.areas;
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.map_areas rows: %', public_count;
  RAISE NOTICE '  maps.areas rows: %', maps_count;
  
  IF maps_count >= public_count THEN
    RAISE NOTICE '✅ Migration successful! All rows migrated.';
  ELSE
    RAISE WARNING '⚠️  Migration incomplete. Missing % rows.', public_count - maps_count;
  END IF;
END $$;
