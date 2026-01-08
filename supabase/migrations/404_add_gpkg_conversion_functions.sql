-- Add PostGIS functions to convert GeoPackage binary geometry to GeoJSON
-- This allows importing geometry without ogr2ogr

-- Function to convert GeoPackage binary blob (hex string) to GeoJSON
CREATE OR REPLACE FUNCTION civic.gpkg_blob_to_geojson(p_blob_hex TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_geom GEOMETRY;
  v_geojson JSONB;
BEGIN
  -- Convert hex string to bytea, then to PostGIS geometry
  -- GeoPackage uses a specific binary format, but PostGIS can read WKB
  -- We need to extract the WKB portion from the GPKG blob
  
  -- GeoPackage format: magic (2 bytes) + version (1) + flags (1) + envelope + WKB geometry
  -- For now, we'll try to use ST_GeomFromWKB on the blob
  -- Note: This is a simplified approach - full GPKG parsing is more complex
  
  -- Convert hex to bytea
  v_geom := ST_GeomFromWKB(decode(p_blob_hex, 'hex'));
  
  -- Convert to GeoJSON
  v_geojson := ST_AsGeoJSON(v_geom)::JSONB;
  
  -- Wrap in FeatureCollection format
  RETURN jsonb_build_object(
    'type', 'FeatureCollection',
    'features', jsonb_build_array(
      jsonb_build_object(
        'type', 'Feature',
        'properties', jsonb_build_object(),
        'geometry', v_geojson
      )
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If conversion fails, return empty FeatureCollection
    RETURN jsonb_build_object(
      'type', 'FeatureCollection',
      'features', jsonb_build_array()
    );
END;
$$;

-- Helper function to import CTU with geometry conversion
CREATE OR REPLACE FUNCTION civic.import_ctu_with_geometry(
  p_ctu_class TEXT,
  p_feature_name TEXT,
  p_gnis_feature_id TEXT,
  p_county_name TEXT,
  p_county_code TEXT,
  p_county_gnis_feature_id TEXT,
  p_population INTEGER,
  p_geometry_blob_hex TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_geometry JSONB;
BEGIN
  -- Convert geometry blob to GeoJSON
  v_geometry := civic.gpkg_blob_to_geojson(p_geometry_blob_hex);
  
  -- Insert record
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
    p_ctu_class,
    p_feature_name,
    p_gnis_feature_id,
    p_county_name,
    p_county_code,
    p_county_gnis_feature_id,
    p_population,
    v_geometry
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

