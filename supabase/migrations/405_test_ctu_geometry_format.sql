-- Test CTU boundaries import with a single city and township
-- This verifies the geometry format is correct before full import

-- Clear any existing test records
DELETE FROM civic.ctu_boundaries 
WHERE feature_name IN ('Ada', 'Augsburg Township');

-- Insert test city (Ada) with proper FeatureCollection geometry format
-- Note: This uses a placeholder geometry - actual coordinates would come from GeoPackage
INSERT INTO civic.ctu_boundaries (
  ctu_class,
  feature_name,
  gnis_feature_id,
  county_name,
  county_code,
  county_gnis_feature_id,
  population,
  geometry
) VALUES (
  'CITY',
  'Ada',
  '2393879',
  'Norman',
  '54',
  '659499',
  1773,
  jsonb_build_object(
    'type', 'FeatureCollection',
    'features', jsonb_build_array(
      jsonb_build_object(
        'type', 'Feature',
        'properties', jsonb_build_object(),
        'geometry', jsonb_build_object(
          'type', 'Polygon',
          'coordinates', jsonb_build_array(
            -- Placeholder coordinates - will be replaced with actual from GeoPackage
            jsonb_build_array(
              jsonb_build_array(-96.5, 47.3),
              jsonb_build_array(-96.4, 47.3),
              jsonb_build_array(-96.4, 47.4),
              jsonb_build_array(-96.5, 47.4),
              jsonb_build_array(-96.5, 47.3)
            )
          )
        )
      )
    )
  )
);

-- Insert test township (Augsburg Township) with proper FeatureCollection geometry format
INSERT INTO civic.ctu_boundaries (
  ctu_class,
  feature_name,
  gnis_feature_id,
  county_name,
  county_code,
  county_gnis_feature_id,
  population,
  geometry
) VALUES (
  'TOWNSHIP',
  'Augsburg Township',
  NULL,
  'Carver',
  '19',
  NULL,
  NULL,
  jsonb_build_object(
    'type', 'FeatureCollection',
    'features', jsonb_build_array(
      jsonb_build_object(
        'type', 'Feature',
        'properties', jsonb_build_object(),
        'geometry', jsonb_build_object(
          'type', 'Polygon',
          'coordinates', jsonb_build_array(
            -- Placeholder coordinates - will be replaced with actual from GeoPackage
            jsonb_build_array(
              jsonb_build_array(-93.8, 44.8),
              jsonb_build_array(-93.7, 44.8),
              jsonb_build_array(-93.7, 44.9),
              jsonb_build_array(-93.8, 44.9),
              jsonb_build_array(-93.8, 44.8)
            )
          )
        )
      )
    )
  )
);

-- Verify the test records
SELECT 
  ctu_class,
  feature_name,
  county_name,
  geometry->>'type' as geometry_type,
  jsonb_array_length(geometry->'features') as feature_count,
  geometry->'features'->0->'geometry'->>'type' as feature_geometry_type,
  CASE 
    WHEN jsonb_array_length(geometry->'features'->0->'geometry'->'coordinates'->0) > 0 
    THEN 'has coordinates'
    ELSE 'no coordinates'
  END as coordinate_status
FROM civic.ctu_boundaries
WHERE feature_name IN ('Ada', 'Augsburg Township')
ORDER BY ctu_class, feature_name;

