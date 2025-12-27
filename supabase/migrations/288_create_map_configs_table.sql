-- Create map_configs table for storing reusable map configurations
-- Maps are private by default, visible only to owner
-- One map can be marked as homepage default
-- Stores layer visibility, map style, controls, and optional viewport state

-- ============================================================================
-- STEP 1: Create map_configs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.map_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Basic metadata
  title TEXT NOT NULL,
  description TEXT,
  
  -- Homepage flag (only one should be true system-wide)
  is_homepage BOOLEAN NOT NULL DEFAULT false,
  
  -- Map style: streets, satellite, light, dark, outdoors
  style TEXT NOT NULL DEFAULT 'streets' 
    CHECK (style IN ('streets', 'satellite', 'light', 'dark', 'outdoors')),
  
  -- Layer configuration: JSONB array of layer objects
  -- Format: [{"id": "cities", "visible": true}, {"id": "lakes", "visible": false}, ...]
  -- Layer IDs: cities, counties, neighborhoods, schools, parks, lakes, watertowers,
  --            cemeteries, golf_courses, hospitals, airports, churches, municipals,
  --            roads, radio_and_news
  layers JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Controls configuration: JSONB object for various map controls
  -- Format: {"buildings": {"enabled": false, "opacity": 0.6}, "pointsOfInterest": false, ...}
  controls JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Optional viewport state (all nullable for layer-only presets)
  viewport JSONB,
  -- viewport format: {"center": [-93.2650, 44.9778], "zoom": 10, "pitch": 0, "bearing": 0}
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure only one homepage map exists (enforced via unique partial index)
  CONSTRAINT map_configs_title_not_empty CHECK (length(trim(title)) > 0)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

-- Account lookup
CREATE INDEX idx_map_configs_account_id ON public.map_configs(account_id);

-- Homepage lookup (only one should exist)
CREATE UNIQUE INDEX idx_map_configs_homepage 
  ON public.map_configs(is_homepage) 
  WHERE is_homepage = true;

-- Timestamp for sorting
CREATE INDEX idx_map_configs_created_at ON public.map_configs(created_at DESC);

-- JSONB indexes for common queries
CREATE INDEX idx_map_configs_layers ON public.map_configs USING GIN (layers);
CREATE INDEX idx_map_configs_controls ON public.map_configs USING GIN (controls);
CREATE INDEX idx_map_configs_viewport ON public.map_configs USING GIN (viewport);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_map_configs_updated_at
  BEFORE UPDATE ON public.map_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Create helper function for ownership check
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_owns_map_config(p_map_config_id UUID)
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
    SELECT 1 FROM public.map_configs
    WHERE map_configs.id = p_map_config_id
    AND EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = map_configs.account_id
      AND accounts.user_id = auth.uid()
    )
  );
END;
$$;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.user_owns_map_config(UUID) OWNER TO postgres;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_owns_map_config(UUID) TO authenticated, anon;

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.map_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies
-- ============================================================================

-- Policy: Users can view their own map configs and the homepage map
CREATE POLICY "Users can view own map configs and homepage"
  ON public.map_configs
  FOR SELECT
  TO authenticated, anon
  USING (
    public.user_owns_map_config(map_configs.id) 
    OR map_configs.is_homepage = true
  );

-- Policy: Users can create map configs
-- Note: Setting is_homepage=true should be done via set_homepage_map_config() function
-- This policy allows creation but homepage flag should be set separately
CREATE POLICY "Users can create map configs"
  ON public.map_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- Policy: Users can update their own map configs
-- Note: is_homepage changes should use set_homepage_map_config() function
-- Direct updates to is_homepage are allowed but discouraged (function is safer)
CREATE POLICY "Users can update own map configs"
  ON public.map_configs
  FOR UPDATE
  TO authenticated
  USING (public.user_owns_map_config(map_configs.id))
  WITH CHECK (
    public.user_owns_map_config(map_configs.id)
    -- Allow updates, but homepage flag changes should use function
  );

-- Policy: Users can delete their own map configs (but not homepage)
CREATE POLICY "Users can delete own map configs"
  ON public.map_configs
  FOR DELETE
  TO authenticated
  USING (
    public.user_owns_map_config(map_configs.id)
    AND is_homepage = false -- Prevent deletion of homepage map
  );

-- ============================================================================
-- STEP 7: Create function to safely set homepage map
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_homepage_map_config(p_map_config_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user owns the map config
  IF NOT public.user_owns_map_config(p_map_config_id) THEN
    RAISE EXCEPTION 'User does not own this map config';
  END IF;
  
  -- Unset all other homepage flags
  UPDATE public.map_configs
  SET is_homepage = false
  WHERE is_homepage = true;
  
  -- Set this map as homepage
  UPDATE public.map_configs
  SET is_homepage = true
  WHERE id = p_map_config_id;
END;
$$;

-- Ensure function is owned by postgres
ALTER FUNCTION public.set_homepage_map_config(UUID) OWNER TO postgres;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.set_homepage_map_config(UUID) TO authenticated;

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_configs TO authenticated;
GRANT SELECT ON public.map_configs TO anon;

-- ============================================================================
-- STEP 9: Add comments
-- ============================================================================

COMMENT ON TABLE public.map_configs IS 'Reusable map configurations storing layer visibility, styles, controls, and optional viewport state. Private by default, visible only to owner. One map can be marked as homepage default.';
COMMENT ON COLUMN public.map_configs.account_id IS 'Account that owns this map configuration (required)';
COMMENT ON COLUMN public.map_configs.title IS 'Map configuration title (required)';
COMMENT ON COLUMN public.map_configs.description IS 'Optional description of the map configuration';
COMMENT ON COLUMN public.map_configs.is_homepage IS 'Whether this is the default homepage map. Only one map should have this set to true.';
COMMENT ON COLUMN public.map_configs.style IS 'Mapbox style: streets, satellite, light, dark, or outdoors';
COMMENT ON COLUMN public.map_configs.layers IS 'JSONB array of layer configurations. Format: [{"id": "cities", "visible": true}, ...]. Layer IDs: cities, counties, neighborhoods, schools, parks, lakes, watertowers, cemeteries, golf_courses, hospitals, airports, churches, municipals, roads, radio_and_news';
COMMENT ON COLUMN public.map_configs.controls IS 'JSONB object for map controls configuration. Format: {"buildings": {"enabled": false, "opacity": 0.6}, "pointsOfInterest": false, "roads": true, "labels": true, "water": true, "landcover": true}';
COMMENT ON COLUMN public.map_configs.viewport IS 'Optional viewport state. Format: {"center": [-93.2650, 44.9778], "zoom": 10, "pitch": 0, "bearing": 0}. If null, map works at any viewport.';
COMMENT ON FUNCTION public.user_owns_map_config(UUID) IS 'Checks if the current authenticated user owns the specified map config. Uses SECURITY DEFINER to bypass RLS on accounts table.';
COMMENT ON FUNCTION public.set_homepage_map_config(UUID) IS 'Safely sets a map config as the homepage default. Unsets all other homepage flags and sets the specified map. Requires ownership.';

