-- Create System Visibility Control Tables
-- Allows admins to control which database schemas/systems are accessible

CREATE SCHEMA IF NOT EXISTS admin;

-- System-level visibility (maps to database schemas)
CREATE TABLE IF NOT EXISTS admin.system_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name TEXT NOT NULL UNIQUE, -- Database schema name: 'maps', 'civic', 'stories'
  system_name TEXT NOT NULL, -- Display name: 'Maps', 'Government Directory'
  primary_route TEXT NOT NULL, -- Main route: '/maps', '/gov'
  is_visible BOOLEAN DEFAULT true, -- Can users access this system?
  is_enabled BOOLEAN DEFAULT true, -- Is system fully functional?
  requires_feature TEXT, -- Optional: billing feature slug (e.g., 'unlimited_maps')
  description TEXT,
  icon TEXT, -- Icon identifier for UI
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route-level visibility (granular control)
CREATE TABLE IF NOT EXISTS admin.route_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_path TEXT NOT NULL UNIQUE, -- Route path: '/maps', '/gov/people'
  system_id UUID REFERENCES admin.system_visibility(id) ON DELETE CASCADE,
  is_visible BOOLEAN DEFAULT true,
  requires_feature TEXT, -- Optional: billing feature slug
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_visibility_schema ON admin.system_visibility(schema_name);
CREATE INDEX IF NOT EXISTS idx_system_visibility_visible ON admin.system_visibility(is_visible) WHERE is_visible = true;
CREATE INDEX IF NOT EXISTS idx_route_visibility_path ON admin.route_visibility(route_path);
CREATE INDEX IF NOT EXISTS idx_route_visibility_system ON admin.route_visibility(system_id);

-- Function to check if a route is visible
CREATE OR REPLACE FUNCTION admin.is_route_visible(route_path TEXT, user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  route_visible BOOLEAN;
  system_visible BOOLEAN;
  system_enabled BOOLEAN;
  required_feature TEXT;
  has_feature BOOLEAN;
BEGIN
  -- Check route-level visibility first
  SELECT rv.is_visible, rv.requires_feature, sv.is_visible, sv.is_enabled
  INTO route_visible, required_feature, system_visible, system_enabled
  FROM admin.route_visibility rv
  LEFT JOIN admin.system_visibility sv ON rv.system_id = sv.id
  WHERE rv.route_path = admin.is_route_visible.route_path
  LIMIT 1;
  
  -- If route has explicit visibility setting
  IF route_visible IS NOT NULL THEN
    -- Check if route is hidden
    IF route_visible = false THEN
      RETURN false;
    END IF;
    
    -- Check feature requirement for route
    IF required_feature IS NOT NULL AND user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM billing.account_has_feature(
          (SELECT id FROM accounts WHERE user_id = admin.is_route_visible.user_id LIMIT 1),
          required_feature
        )
      ) INTO has_feature;
      
      IF NOT has_feature THEN
        RETURN false;
      END IF;
    END IF;
    
    -- Check system visibility/enabled
    IF system_visible = false OR system_enabled = false THEN
      RETURN false;
    END IF;
    
    RETURN true;
  END IF;
  
  -- No explicit route setting, check system-level visibility
  SELECT sv.is_visible, sv.is_enabled, sv.requires_feature
  INTO system_visible, system_enabled, required_feature
  FROM admin.system_visibility sv
  WHERE sv.primary_route = admin.is_route_visible.route_path
     OR admin.is_route_visible.route_path LIKE sv.primary_route || '/%'
  LIMIT 1;
  
  -- If system found
  IF system_visible IS NOT NULL THEN
    -- Check if system is hidden or disabled
    IF system_visible = false OR system_enabled = false THEN
      RETURN false;
    END IF;
    
    -- Check feature requirement
    IF required_feature IS NOT NULL AND user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM billing.account_has_feature(
          (SELECT id FROM accounts WHERE user_id = admin.is_route_visible.user_id LIMIT 1),
          required_feature
        )
      ) INTO has_feature;
      
      IF NOT has_feature THEN
        RETURN false;
      END IF;
    END IF;
    
    RETURN true;
  END IF;
  
  -- No visibility rules found, default to visible
  RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all visible systems for a user
CREATE OR REPLACE FUNCTION admin.get_visible_systems(user_id UUID DEFAULT NULL)
RETURNS TABLE (
  schema_name TEXT,
  system_name TEXT,
  primary_route TEXT,
  is_visible BOOLEAN,
  is_enabled BOOLEAN,
  requires_feature TEXT,
  description TEXT,
  icon TEXT,
  display_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sv.schema_name,
    sv.system_name,
    sv.primary_route,
    sv.is_visible,
    sv.is_enabled,
    sv.requires_feature,
    sv.description,
    sv.icon,
    sv.display_order
  FROM admin.system_visibility sv
  WHERE sv.is_visible = true
    AND sv.is_enabled = true
    AND (
      sv.requires_feature IS NULL
      OR user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM billing.account_has_feature(
          (SELECT id FROM accounts WHERE accounts.user_id = admin.get_visible_systems.user_id LIMIT 1),
          sv.requires_feature
        )
      )
    )
  ORDER BY sv.display_order, sv.system_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Seed initial systems based on schema-to-route mapping
INSERT INTO admin.system_visibility (schema_name, system_name, primary_route, display_order, description) VALUES
  ('maps', 'Maps', '/maps', 1, 'Custom maps and map management'),
  ('civic', 'Government Directory', '/gov', 2, 'Minnesota government officials and organizations'),
  ('stories', 'Stories', '/stories', 3, 'Social stories feature'),
  ('feeds', 'Feed', '/feed', 4, 'Activity feed'),
  ('pages', 'Pages', '/pages', 5, 'Custom pages'),
  ('social_graph', 'Friends', '/friends', 6, 'Social connections'),
  ('messaging', 'Messages', '/messages', 7, 'Direct messaging'),
  ('places', 'Places', '/explore/places', 8, 'Places directory'),
  ('ads', 'Ad Center', '/ad_center', 9, 'Advertising management'),
  ('analytics', 'Analytics', '/analytics', 10, 'Platform analytics')
ON CONFLICT (schema_name) DO NOTHING;

-- RLS Policies
ALTER TABLE admin.system_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.route_visibility ENABLE ROW LEVEL SECURITY;

-- Everyone can read system visibility
CREATE POLICY "System visibility is viewable by everyone"
  ON admin.system_visibility FOR SELECT
  USING (true);

CREATE POLICY "Route visibility is viewable by everyone"
  ON admin.route_visibility FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can modify system visibility"
  ON admin.system_visibility FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can modify route visibility"
  ON admin.route_visibility FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );
