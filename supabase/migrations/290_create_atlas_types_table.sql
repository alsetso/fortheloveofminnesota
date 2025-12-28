-- Create atlas_types table for admin configuration of atlas entity types
-- Controls icon, name, visibility, and status for each atlas table type

-- ============================================================================
-- STEP 1: Create status enum
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE atlas.atlas_type_status AS ENUM ('active', 'coming_soon', 'unlisted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: Create atlas_types table
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.atlas_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  slug TEXT NOT NULL UNIQUE, -- Matches table name (e.g., 'schools', 'parks')
  name TEXT NOT NULL, -- Display name (e.g., 'Schools', 'Parks')
  description TEXT, -- Optional description
  
  -- Configuration
  icon_path TEXT, -- Path to icon image (e.g., '/education.png')
  is_visible BOOLEAN DEFAULT TRUE, -- Whether to show in listings/navigation
  status atlas.atlas_type_status DEFAULT 'active' NOT NULL, -- Controls map rendering and page access
  
  -- Display
  display_order INTEGER DEFAULT 0, -- Order in lists (lower = first)
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT atlas_types_slug_format CHECK (slug ~ '^[a-z0-9_]+$') -- Lowercase, alphanumeric, underscores only
);

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX idx_atlas_types_slug ON atlas.atlas_types(slug);
CREATE INDEX idx_atlas_types_status ON atlas.atlas_types(status);
CREATE INDEX idx_atlas_types_is_visible ON atlas.atlas_types(is_visible) WHERE is_visible = true;
CREATE INDEX idx_atlas_types_display_order ON atlas.atlas_types(display_order);

-- ============================================================================
-- STEP 4: Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION atlas.update_atlas_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atlas_types_updated_at
  BEFORE UPDATE ON atlas.atlas_types
  FOR EACH ROW
  EXECUTE FUNCTION atlas.update_atlas_types_updated_at();

-- ============================================================================
-- STEP 5: Grant schema and table permissions
-- ============================================================================

-- Grant USAGE on schema to service_role (required for service role to access schema)
GRANT USAGE ON SCHEMA atlas TO service_role;

-- Grant permissions on table
GRANT SELECT ON atlas.atlas_types TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.atlas_types TO authenticated;
GRANT ALL ON atlas.atlas_types TO service_role;

-- ============================================================================
-- STEP 6: Add RLS policies (if RLS is enabled)
-- ============================================================================

-- Allow public read access
ALTER TABLE atlas.atlas_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atlas_types_select_public" ON atlas.atlas_types
  FOR SELECT
  USING (true);

-- Admin can do everything (will be enforced by application-level auth)
-- RLS policies for INSERT/UPDATE/DELETE should be added based on your auth setup

