-- Add lat, lng columns to map.points_of_interest for easier querying
-- These columns store the coordinates separately from the geography column

-- ============================================================================
-- STEP 1: Add lat and lng columns
-- ============================================================================

ALTER TABLE map.points_of_interest
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- ============================================================================
-- STEP 2: Create indexes for lat/lng queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS points_of_interest_lat_lng_idx 
  ON map.points_of_interest (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================================================
-- STEP 3: Backfill existing records with lat/lng from location geography
-- ============================================================================

UPDATE map.points_of_interest
SET 
  lng = ST_X(location::geometry),
  lat = ST_Y(location::geometry)
WHERE lat IS NULL OR lng IS NULL
  AND location IS NOT NULL;

-- ============================================================================
-- STEP 4: Create trigger function to auto-populate lat/lng on insert/update
-- ============================================================================

CREATE OR REPLACE FUNCTION map.sync_points_of_interest_coordinates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If location is set but lat/lng are not, extract from location
  IF NEW.location IS NOT NULL AND (NEW.lat IS NULL OR NEW.lng IS NULL) THEN
    NEW.lng := ST_X(NEW.location::geometry);
    NEW.lat := ST_Y(NEW.location::geometry);
  END IF;
  
  -- If lat/lng are set but location is not, create location from lat/lng
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL AND NEW.location IS NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 5: Create trigger
-- ============================================================================

DROP TRIGGER IF EXISTS sync_points_of_interest_coordinates_trigger ON map.points_of_interest;

CREATE TRIGGER sync_points_of_interest_coordinates_trigger
  BEFORE INSERT OR UPDATE ON map.points_of_interest
  FOR EACH ROW
  EXECUTE FUNCTION map.sync_points_of_interest_coordinates();

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON COLUMN map.points_of_interest.lat IS 'Latitude coordinate (extracted from location geography for easier querying)';
COMMENT ON COLUMN map.points_of_interest.lng IS 'Longitude coordinate (extracted from location geography for easier querying)';
COMMENT ON FUNCTION map.sync_points_of_interest_coordinates() IS 'Automatically syncs lat/lng with location geography column on insert/update';

