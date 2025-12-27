-- Create user maps and points system
-- Users can create maps, add points to them, and share maps with other accounts
-- Maps are private by default, shareable with view or edit permissions

-- ============================================================================
-- STEP 1: Create map_permission enum
-- ============================================================================

CREATE TYPE public.map_permission AS ENUM ('view', 'edit');

-- ============================================================================
-- STEP 2: Create maps table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create points table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  label TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: Create map_shares junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.map_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  permission public.map_permission NOT NULL DEFAULT 'view'::public.map_permission,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique map-account pairs (one share per account per map)
  CONSTRAINT map_shares_unique UNIQUE (map_id, account_id)
);

-- ============================================================================
-- STEP 5: Create indexes
-- ============================================================================

-- Maps indexes
CREATE INDEX idx_maps_account_id ON public.maps(account_id);
CREATE INDEX idx_maps_created_at ON public.maps(created_at DESC);

-- Points indexes
CREATE INDEX idx_points_map_id ON public.points(map_id);
CREATE INDEX idx_points_account_id ON public.points(account_id);
-- Spatial index for lat/lng queries (Mapbox optimal)
CREATE INDEX idx_points_lat_lng ON public.points(lat, lng);
CREATE INDEX idx_points_created_at ON public.points(created_at DESC);

-- Map shares indexes
CREATE INDEX idx_map_shares_map_id ON public.map_shares(map_id);
CREATE INDEX idx_map_shares_account_id ON public.map_shares(account_id);
CREATE INDEX idx_map_shares_permission ON public.map_shares(map_id, permission);

-- ============================================================================
-- STEP 6: Create updated_at triggers
-- ============================================================================

-- Trigger for maps.updated_at
CREATE TRIGGER update_maps_updated_at
  BEFORE UPDATE ON public.maps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for points.updated_at
CREATE TRIGGER update_points_updated_at
  BEFORE UPDATE ON public.points
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 7: Create helper functions for access checks
-- ============================================================================

-- Function to check if user owns a map
-- Uses p_map_id parameter to avoid ambiguous column reference
CREATE OR REPLACE FUNCTION public.user_owns_map(p_map_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.maps
    WHERE maps.id = p_map_id
    AND EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = maps.account_id
      AND accounts.user_id = auth.uid()
    )
  );
END;
$$;

-- Function to check if user has access to a map (owner or shared)
-- Uses p_map_id parameter to avoid ambiguous column reference
CREATE OR REPLACE FUNCTION public.user_has_map_access(p_map_id UUID, required_permission public.map_permission DEFAULT 'view'::public.map_permission)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_is_owner BOOLEAN;
  v_share_permission public.map_permission;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get current user's account_id
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE accounts.user_id = auth.uid()
  LIMIT 1;
  
  IF v_account_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user owns the map
  SELECT EXISTS (
    SELECT 1 FROM public.maps
    WHERE maps.id = p_map_id
    AND maps.account_id = v_account_id
  ) INTO v_is_owner;
  
  IF v_is_owner THEN
    RETURN TRUE; -- Owners have full access
  END IF;
  
  -- Check if map is shared with user
  SELECT permission INTO v_share_permission
  FROM public.map_shares
  WHERE map_shares.map_id = p_map_id
  AND map_shares.account_id = v_account_id
  LIMIT 1;
  
  IF v_share_permission IS NULL THEN
    RETURN FALSE; -- No share found
  END IF;
  
  -- Check permission level
  IF required_permission = 'edit' THEN
    RETURN v_share_permission = 'edit'; -- Need edit permission
  ELSE
    RETURN TRUE; -- View permission is sufficient for view access
  END IF;
END;
$$;

-- Ensure functions are owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.user_owns_map(UUID) OWNER TO postgres;
ALTER FUNCTION public.user_has_map_access(UUID, public.map_permission) OWNER TO postgres;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_owns_map(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_map_access(UUID, public.map_permission) TO authenticated, anon;

-- ============================================================================
-- STEP 8: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_shares ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: Create RLS policies for maps
-- ============================================================================

-- Policy: Users can view maps they own or that are shared with them
CREATE POLICY "Users can view accessible maps"
  ON public.maps
  FOR SELECT
  TO authenticated
  USING (public.user_has_map_access(maps.id, 'view'::public.map_permission));

-- Policy: Users can create maps
CREATE POLICY "Users can create maps"
  ON public.maps
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    -- Must own the account (uses SECURITY DEFINER function)
    AND account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- Policy: Users can update maps they own
CREATE POLICY "Users can update own maps"
  ON public.maps
  FOR UPDATE
  TO authenticated
  USING (public.user_owns_map(maps.id))
  WITH CHECK (public.user_owns_map(maps.id));

-- Policy: Users can delete maps they own
CREATE POLICY "Users can delete own maps"
  ON public.maps
  FOR DELETE
  TO authenticated
  USING (public.user_owns_map(maps.id));

-- ============================================================================
-- STEP 10: Create RLS policies for points
-- ============================================================================

-- Policy: Users can view points on maps they have access to
CREATE POLICY "Users can view accessible points"
  ON public.points
  FOR SELECT
  TO authenticated
  USING (public.user_has_map_access(points.map_id, 'view'::public.map_permission));

-- Policy: Users can create points on maps they have edit access to
CREATE POLICY "Users can create points on accessible maps"
  ON public.points
  FOR INSERT
  TO authenticated
  WITH CHECK (
    map_id IS NOT NULL AND
    account_id IS NOT NULL AND
    public.user_has_map_access(map_id, 'edit'::public.map_permission) AND
    public.user_owns_account(account_id)
  );

-- Policy: Users can update points on maps they have edit access to
CREATE POLICY "Users can update points on accessible maps"
  ON public.points
  FOR UPDATE
  TO authenticated
  USING (public.user_has_map_access(points.map_id, 'edit'::public.map_permission))
  WITH CHECK (public.user_has_map_access(points.map_id, 'edit'::public.map_permission));

-- Policy: Users can delete points on maps they have edit access to
CREATE POLICY "Users can delete points on accessible maps"
  ON public.points
  FOR DELETE
  TO authenticated
  USING (public.user_has_map_access(points.map_id, 'edit'::public.map_permission));

-- ============================================================================
-- STEP 11: Create RLS policies for map_shares
-- ============================================================================

-- Policy: Users can view shares for maps they own
CREATE POLICY "Users can view shares for own maps"
  ON public.map_shares
  FOR SELECT
  TO authenticated
  USING (public.user_owns_map(map_shares.map_id));

-- Policy: Users can create shares for maps they own
CREATE POLICY "Users can share own maps"
  ON public.map_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    map_id IS NOT NULL AND
    account_id IS NOT NULL AND
    public.user_owns_map(map_id) AND
    -- Prevent sharing with yourself
    account_id != (SELECT id FROM public.accounts WHERE accounts.user_id = auth.uid() LIMIT 1)
  );

-- Policy: Users can update shares for maps they own
CREATE POLICY "Users can update shares for own maps"
  ON public.map_shares
  FOR UPDATE
  TO authenticated
  USING (public.user_owns_map(map_shares.map_id))
  WITH CHECK (public.user_owns_map(map_shares.map_id));

-- Policy: Users can delete shares for maps they own
CREATE POLICY "Users can delete shares for own maps"
  ON public.map_shares
  FOR DELETE
  TO authenticated
  USING (public.user_owns_map(map_shares.map_id));

-- ============================================================================
-- STEP 12: Grant permissions
-- ============================================================================

-- Maps permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps TO authenticated;

-- Points permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.points TO authenticated;

-- Map shares permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_shares TO authenticated;

-- ============================================================================
-- STEP 13: Add comments
-- ============================================================================

COMMENT ON TABLE public.maps IS 'User-created maps. Private by default, shareable with other accounts via map_shares table.';
COMMENT ON COLUMN public.maps.account_id IS 'Account that owns this map (required)';
COMMENT ON COLUMN public.maps.title IS 'Map title (required)';
COMMENT ON COLUMN public.maps.description IS 'Optional map description';

COMMENT ON TABLE public.points IS 'Points/markers placed on user maps. Points can only be added/edited by map owners or accounts with edit permission.';
COMMENT ON COLUMN public.points.map_id IS 'Map this point belongs to';
COMMENT ON COLUMN public.points.account_id IS 'Account that created this point (for attribution)';
COMMENT ON COLUMN public.points.lat IS 'Latitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.points.lng IS 'Longitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.points.label IS 'Optional point label';
COMMENT ON COLUMN public.points.description IS 'Optional point description';

COMMENT ON TABLE public.map_shares IS 'Junction table for sharing maps with other accounts. Each row represents a share with a specific permission level (view or edit).';
COMMENT ON COLUMN public.map_shares.map_id IS 'Map being shared';
COMMENT ON COLUMN public.map_shares.account_id IS 'Account the map is shared with';
COMMENT ON COLUMN public.map_shares.permission IS 'Permission level: view (read-only) or edit (can modify points)';

COMMENT ON TYPE public.map_permission IS 'Permission level for map sharing: view (read-only) or edit (can modify points)';

COMMENT ON FUNCTION public.user_owns_map(UUID) IS 'Checks if the current authenticated user owns the specified map. Uses SECURITY DEFINER to bypass RLS on accounts table. Parameter name p_map_id avoids ambiguous column reference.';
COMMENT ON FUNCTION public.user_has_map_access(UUID, public.map_permission) IS 'Checks if the current authenticated user has access to a map (either as owner or via share). Returns true if user has the required permission level or higher. Parameter name p_map_id avoids ambiguous column reference.';








