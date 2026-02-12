-- Fix system visibility function to use explicit schema references
-- Ensures production-ready schema references

-- Update is_route_visible function to use public.accounts explicitly and ensure homepage is always visible
CREATE OR REPLACE FUNCTION admin.is_route_visible(p_route_path TEXT, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  route_visible BOOLEAN;
  system_visible BOOLEAN;
  system_enabled BOOLEAN;
  required_feature TEXT;
  has_feature BOOLEAN;
BEGIN
  -- Homepage is ALWAYS visible - critical for system shutdown scenarios
  IF p_route_path = '/' THEN
    RETURN true;
  END IF;
  
  -- Check route-level visibility first
  SELECT rv.is_visible, rv.requires_feature, sv.is_visible, sv.is_enabled
  INTO route_visible, required_feature, system_visible, system_enabled
  FROM admin.route_visibility rv
  LEFT JOIN admin.system_visibility sv ON rv.system_id = sv.id
  WHERE rv.route_path = p_route_path
  LIMIT 1;
  
  -- If route has explicit visibility setting
  IF route_visible IS NOT NULL THEN
    -- Check if route is hidden
    IF route_visible = false THEN
      RETURN false;
    END IF;
    
    -- Check feature requirement for route
    IF required_feature IS NOT NULL AND p_user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM billing.account_has_feature(
          (SELECT id FROM public.accounts WHERE user_id = p_user_id LIMIT 1),
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
  WHERE sv.primary_route = p_route_path
     OR p_route_path LIKE sv.primary_route || '/%'
  LIMIT 1;
  
  -- If system found
  IF system_visible IS NOT NULL THEN
    -- Check if system is hidden or disabled
    IF system_visible = false OR system_enabled = false THEN
      RETURN false;
    END IF;
    
    -- Check feature requirement
    IF required_feature IS NOT NULL AND p_user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM billing.account_has_feature(
          (SELECT id FROM public.accounts WHERE user_id = p_user_id LIMIT 1),
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

-- Update get_visible_systems function to use public.accounts explicitly
CREATE OR REPLACE FUNCTION admin.get_visible_systems(p_user_id UUID DEFAULT NULL)
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
      OR p_user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM billing.account_has_feature(
          (SELECT id FROM public.accounts WHERE user_id = p_user_id LIMIT 1),
          sv.requires_feature
        )
      )
    )
  ORDER BY sv.display_order, sv.system_name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION admin.is_route_visible IS 
  'Checks if a route is visible based on system and route visibility settings. Homepage (/) is always visible. Uses public.accounts for account lookups.';

COMMENT ON FUNCTION admin.get_visible_systems IS 
  'Returns all visible systems for a user. Uses public.accounts for account lookups.';
