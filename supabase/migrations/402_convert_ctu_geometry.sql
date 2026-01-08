-- Convert existing CTU boundary geometry to proper GeoJSON format
-- This migration ensures geometry is properly formatted as FeatureCollection

-- First, let's check if geometry needs conversion
-- The geometry column should already be in JSONB format
-- We just need to ensure it's in the correct FeatureCollection format

-- Update any geometries that might be in wrong format
UPDATE civic.ctu_boundaries
SET geometry = jsonb_build_object(
  'type', 'FeatureCollection',
  'features', jsonb_build_array(
    jsonb_build_object(
      'type', 'Feature',
      'properties', jsonb_build_object(),
      'geometry', geometry->'features'->0->'geometry'
    )
  )
)
WHERE geometry IS NOT NULL
  AND geometry->>'type' != 'FeatureCollection'
  AND geometry->'features'->0->'geometry' IS NOT NULL;

-- Ensure all geometries have the proper FeatureCollection structure
UPDATE civic.ctu_boundaries
SET geometry = jsonb_build_object(
  'type', 'FeatureCollection',
  'features', CASE
    WHEN geometry->'features' IS NOT NULL THEN geometry->'features'
    WHEN geometry->'geometry' IS NOT NULL THEN jsonb_build_array(
      jsonb_build_object(
        'type', 'Feature',
        'properties', jsonb_build_object(),
        'geometry', geometry->'geometry'
      )
    )
    ELSE jsonb_build_array()
  END
)
WHERE geometry IS NOT NULL
  AND (
    geometry->>'type' != 'FeatureCollection'
    OR geometry->'features' IS NULL
  );

-- Verify the conversion
SELECT 
  COUNT(*) as total_records,
  COUNT(geometry) as records_with_geometry,
  COUNT(CASE WHEN geometry->>'type' = 'FeatureCollection' THEN 1 END) as properly_formatted
FROM civic.ctu_boundaries;

