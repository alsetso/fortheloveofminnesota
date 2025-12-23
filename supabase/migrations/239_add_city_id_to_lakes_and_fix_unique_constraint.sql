-- Add city_id to lakes table and fix unique constraint to be per-city
-- This allows the same lake name to exist in different cities (e.g., "Lake Harriet" in different areas)
-- NOTE: This migration is superseded by migration 240 which handles all atlas tables comprehensively
-- Keeping this for historical reference, but migration 240 should be run instead

-- ============================================================================
-- STEP 1: Add city_id column to lakes table
-- ============================================================================

ALTER TABLE atlas.lakes
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 2: Create index on city_id for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lakes_city_id ON atlas.lakes(city_id) WHERE city_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Drop old unique constraint on name
-- ============================================================================

-- Drop the old UNIQUE constraint on name column
-- Try multiple possible constraint names
ALTER TABLE atlas.lakes DROP CONSTRAINT IF EXISTS lakes_name_key;
ALTER TABLE atlas.lakes DROP CONSTRAINT IF EXISTS lakes_name_unique;
ALTER TABLE atlas.lakes DROP CONSTRAINT IF EXISTS lakes_pkey; -- In case name was primary key (shouldn't be)

-- Also check if there's a unique index on name
DROP INDEX IF EXISTS atlas.lakes_name_key;
DROP INDEX IF EXISTS atlas.lakes_name_unique;

-- ============================================================================
-- STEP 4: Add new unique constraint on (name, city_id)
-- ============================================================================

-- Add unique constraint on name + city_id combination
-- This allows same lake name in different cities, but unique within a city
-- Note: In PostgreSQL, NULL values in UNIQUE constraints are considered distinct,
-- so multiple lakes with same name and NULL city_id are allowed
ALTER TABLE atlas.lakes 
  ADD CONSTRAINT lakes_name_city_unique UNIQUE (name, city_id);

-- ============================================================================
-- STEP 5: Add comment explaining the constraint
-- ============================================================================

COMMENT ON CONSTRAINT lakes_name_city_unique ON atlas.lakes IS 'Ensures lake names are unique per city, allowing same name in different cities';

-- ============================================================================
-- STEP 6: Update the public view trigger functions to include city_id
-- ============================================================================

-- Update insert trigger to handle city_id
CREATE OR REPLACE FUNCTION public.lakes_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.lakes (
    name, lat, lng, polygon, city_id, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.lat,
    NEW.lng,
    NEW.polygon,
    NEW.city_id,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Update update trigger to handle city_id
CREATE OR REPLACE FUNCTION public.lakes_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.lakes
  SET
    name = COALESCE(NEW.name, OLD.name),
    lat = NEW.lat,
    lng = NEW.lng,
    polygon = NEW.polygon,
    city_id = NEW.city_id,
    updated_at = NOW()
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;



