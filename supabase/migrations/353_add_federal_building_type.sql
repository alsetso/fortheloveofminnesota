-- Add 'federal' as a valid building type
ALTER TABLE civic.buildings
  DROP CONSTRAINT IF EXISTS buildings_type_check;

ALTER TABLE civic.buildings
  ADD CONSTRAINT buildings_type_check 
  CHECK (type IN ('state', 'city', 'town', 'federal'));

-- Update comment
COMMENT ON COLUMN civic.buildings.type IS 'Type of building: state, city, town, or federal';

