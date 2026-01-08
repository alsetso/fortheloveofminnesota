-- Create civic.buildings table
CREATE TABLE IF NOT EXISTS civic.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('state', 'city', 'town')),
  name TEXT NOT NULL,
  description TEXT,
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  full_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_buildings_type ON civic.buildings(type);
CREATE INDEX IF NOT EXISTS idx_buildings_name ON civic.buildings(name);
CREATE INDEX IF NOT EXISTS idx_buildings_location ON civic.buildings(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buildings_full_address ON civic.buildings(full_address) WHERE full_address IS NOT NULL;

-- Add comments
COMMENT ON TABLE civic.buildings IS 'Buildings owned or used by state, city, or town governments';
COMMENT ON COLUMN civic.buildings.type IS 'Type of building: state, city, or town';
COMMENT ON COLUMN civic.buildings.name IS 'Name of the building';
COMMENT ON COLUMN civic.buildings.description IS 'Description of the building';
COMMENT ON COLUMN civic.buildings.lat IS 'Latitude coordinate';
COMMENT ON COLUMN civic.buildings.lng IS 'Longitude coordinate';
COMMENT ON COLUMN civic.buildings.full_address IS 'Full address string from reverse geocoding';

-- Add building_id columns to other civic tables for future linking
ALTER TABLE civic.orgs
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES civic.buildings(id) ON DELETE SET NULL;

ALTER TABLE civic.people
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES civic.buildings(id) ON DELETE SET NULL;

ALTER TABLE civic.roles
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES civic.buildings(id) ON DELETE SET NULL;

ALTER TABLE civic.events
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES civic.buildings(id) ON DELETE SET NULL;

-- Add indexes for building_id foreign keys
CREATE INDEX IF NOT EXISTS idx_orgs_building_id ON civic.orgs(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_building_id ON civic.people(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_roles_building_id ON civic.roles(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_building_id ON civic.events(building_id) WHERE building_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE civic.buildings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view buildings"
  ON civic.buildings FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admins can insert buildings"
  ON civic.buildings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update buildings"
  ON civic.buildings FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete buildings"
  ON civic.buildings FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Service role can manage buildings"
  ON civic.buildings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant schema usage (if not already granted)
GRANT USAGE ON SCHEMA civic TO service_role;

-- Grant permissions
GRANT SELECT ON civic.buildings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON civic.buildings TO authenticated;
-- Grant all permissions to service_role (needed for admin API routes)
GRANT ALL ON civic.buildings TO service_role;

