-- Drop existing maps system and create new dynamic maps table
-- Supports sharing, custom domains, and pro features

-- ============================================================================
-- STEP 1: Drop existing tables and related objects
-- ============================================================================

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view accessible maps" ON public.maps;
DROP POLICY IF EXISTS "Users can create maps" ON public.maps;
DROP POLICY IF EXISTS "Users can update own maps" ON public.maps;
DROP POLICY IF EXISTS "Users can delete own maps" ON public.maps;

DROP POLICY IF EXISTS "Users can view accessible points" ON public.points;
DROP POLICY IF EXISTS "Users can create points on accessible maps" ON public.points;
DROP POLICY IF EXISTS "Users can update points on accessible maps" ON public.points;
DROP POLICY IF EXISTS "Users can delete points on accessible maps" ON public.points;

DROP POLICY IF EXISTS "Users can view shares for own maps" ON public.map_shares;
DROP POLICY IF EXISTS "Users can share own maps" ON public.map_shares;
DROP POLICY IF EXISTS "Users can update shares for own maps" ON public.map_shares;
DROP POLICY IF EXISTS "Users can delete shares for own maps" ON public.map_shares;

-- Drop tables (CASCADE will handle foreign keys)
DROP TABLE IF EXISTS public.map_shares CASCADE;
DROP TABLE IF EXISTS public.points CASCADE;
DROP TABLE IF EXISTS public.maps CASCADE;

-- Drop enum type (if not used elsewhere)
DROP TYPE IF EXISTS public.map_permission CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.user_owns_map(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_map_access(UUID, public.map_permission) CASCADE;

-- ============================================================================
-- STEP 2: Create new map_permission enum (for sharing)
-- ============================================================================

CREATE TYPE public.map_permission AS ENUM ('view', 'edit', 'admin');

-- ============================================================================
-- STEP 3: Create dynamic maps table
-- ============================================================================

CREATE TABLE public.map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Basic info
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT, -- URL-friendly identifier
  
  -- Sharing
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE, -- Token for public/private sharing
  allow_embedding BOOLEAN NOT NULL DEFAULT false,
  
  -- Custom domain
  custom_domain TEXT UNIQUE, -- e.g., "maps.example.com"
  custom_domain_verified BOOLEAN NOT NULL DEFAULT false,
  custom_domain_verification_token TEXT,
  
  -- Pro features
  requires_pro BOOLEAN NOT NULL DEFAULT false, -- If true, only pro users can access
  pro_features JSONB DEFAULT '{}', -- Store pro feature flags/config
  
  -- Map configuration
  map_config JSONB DEFAULT '{}', -- Mapbox style, center, zoom, etc.
  map_data JSONB DEFAULT '{}', -- Points, layers, annotations, etc.
  
  -- Metadata
  view_count INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false, -- Featured maps (admin only)
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE, -- When map was made public
  
  -- Constraints
  CONSTRAINT map_slug_format CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT map_view_count_non_negative CHECK (view_count >= 0)
);

-- ============================================================================
-- STEP 4: Create map_shares table (for account-based sharing)
-- ============================================================================

CREATE TABLE public.map_share (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  permission public.map_permission NOT NULL DEFAULT 'view'::public.map_permission,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure unique map-account pairs
  CONSTRAINT map_share_unique UNIQUE (map_id, account_id)
);

-- ============================================================================
-- STEP 5: Create indexes
-- ============================================================================

-- Map indexes
CREATE INDEX idx_map_account_id ON public.map(account_id);
CREATE INDEX idx_map_slug ON public.map(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_map_custom_domain ON public.map(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_map_share_token ON public.map(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_map_is_public ON public.map(is_public) WHERE is_public = true;
CREATE INDEX idx_map_requires_pro ON public.map(requires_pro) WHERE requires_pro = true;
CREATE INDEX idx_map_is_featured ON public.map(is_featured) WHERE is_featured = true;
CREATE INDEX idx_map_created_at ON public.map(created_at DESC);
CREATE INDEX idx_map_published_at ON public.map(published_at DESC) WHERE published_at IS NOT NULL;

-- GIN indexes for JSONB columns
CREATE INDEX idx_map_map_config ON public.map USING GIN (map_config);
CREATE INDEX idx_map_map_data ON public.map USING GIN (map_data);
CREATE INDEX idx_map_pro_features ON public.map USING GIN (pro_features);

-- Map share indexes
CREATE INDEX idx_map_share_map_id ON public.map_share(map_id);
CREATE INDEX idx_map_share_account_id ON public.map_share(account_id);
CREATE INDEX idx_map_share_permission ON public.map_share(map_id, permission);

-- ============================================================================
-- STEP 6: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_map_updated_at
  BEFORE UPDATE ON public.map
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 7: Create helper functions for access checks
-- ============================================================================

-- Function to check if user owns a map
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
    SELECT 1 FROM public.map
    WHERE map.id = p_map_id
    AND EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = map.account_id
      AND accounts.user_id = auth.uid()
    )
  );
END;
$$;

-- Function to check if user has access to a map (owner or shared)
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
  v_map_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    -- Check if map is public
    SELECT * INTO v_map_record FROM public.map WHERE map.id = p_map_id;
    IF v_map_record IS NULL THEN
      RETURN FALSE;
    END IF;
    -- Public maps are viewable by anyone
    IF v_map_record.is_public AND required_permission = 'view'::public.map_permission THEN
      RETURN TRUE;
    END IF;
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
  
  -- Get map record
  SELECT * INTO v_map_record FROM public.map WHERE map.id = p_map_id;
  IF v_map_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user owns the map
  IF v_map_record.account_id = v_account_id THEN
    RETURN TRUE; -- Owners have full access
  END IF;
  
  -- Check if map is public
  IF v_map_record.is_public AND required_permission = 'view'::public.map_permission THEN
    RETURN TRUE;
  END IF;
  
  -- Check if map is shared with user
  SELECT permission INTO v_share_permission
  FROM public.map_share
  WHERE map_share.map_id = p_map_id
  AND map_share.account_id = v_account_id
  LIMIT 1;
  
  IF v_share_permission IS NULL THEN
    RETURN FALSE; -- No share found
  END IF;
  
  -- Check permission level (admin > edit > view)
  IF required_permission = 'admin'::public.map_permission THEN
    RETURN v_share_permission = 'admin'::public.map_permission;
  ELSIF required_permission = 'edit'::public.map_permission THEN
    RETURN v_share_permission IN ('edit'::public.map_permission, 'admin'::public.map_permission);
  ELSE
    RETURN TRUE; -- View permission is sufficient for view access
  END IF;
END;
$$;

-- Ensure functions are owned by postgres
ALTER FUNCTION public.user_owns_map(UUID) OWNER TO postgres;
ALTER FUNCTION public.user_has_map_access(UUID, public.map_permission) OWNER TO postgres;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_owns_map(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_map_access(UUID, public.map_permission) TO authenticated, anon;

-- ============================================================================
-- STEP 8: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_share ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: Create RLS policies for map table
-- ============================================================================

-- Policy: Users can view maps they own, are shared with them, or are public
CREATE POLICY "Users can view accessible maps"
  ON public.map
  FOR SELECT
  TO authenticated, anon
  USING (
    public.user_has_map_access(map.id, 'view'::public.map_permission)
  );

-- Policy: Users can create maps
CREATE POLICY "Users can create maps"
  ON public.map
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- Policy: Users can update maps they own or have edit/admin permission
CREATE POLICY "Users can update accessible maps"
  ON public.map
  FOR UPDATE
  TO authenticated
  USING (
    public.user_owns_map(map.id)
    OR public.user_has_map_access(map.id, 'edit'::public.map_permission)
  )
  WITH CHECK (
    public.user_owns_map(map.id)
    OR public.user_has_map_access(map.id, 'edit'::public.map_permission)
  );

-- Policy: Users can delete maps they own
CREATE POLICY "Users can delete own maps"
  ON public.map
  FOR DELETE
  TO authenticated
  USING (public.user_owns_map(map.id));

-- ============================================================================
-- STEP 10: Create RLS policies for map_share table
-- ============================================================================

-- Policy: Users can view shares for maps they own or are shared with them
CREATE POLICY "Users can view accessible shares"
  ON public.map_share
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_map(map_share.map_id)
    OR EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = map_share.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Policy: Users can create shares for maps they own
CREATE POLICY "Users can share own maps"
  ON public.map_share
  FOR INSERT
  TO authenticated
  WITH CHECK (
    map_id IS NOT NULL
    AND account_id IS NOT NULL
    AND public.user_owns_map(map_id)
    -- Prevent sharing with yourself
    AND account_id != (SELECT id FROM public.accounts WHERE accounts.user_id = auth.uid() LIMIT 1)
  );

-- Policy: Users can update shares for maps they own
CREATE POLICY "Users can update shares for own maps"
  ON public.map_share
  FOR UPDATE
  TO authenticated
  USING (public.user_owns_map(map_share.map_id))
  WITH CHECK (public.user_owns_map(map_share.map_id));

-- Policy: Users can delete shares for maps they own
CREATE POLICY "Users can delete shares for own maps"
  ON public.map_share
  FOR DELETE
  TO authenticated
  USING (public.user_owns_map(map_share.map_id));

-- ============================================================================
-- STEP 11: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map TO authenticated;
GRANT SELECT ON public.map TO anon; -- Anonymous users can view public maps
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_share TO authenticated;

-- ============================================================================
-- STEP 12: Add comments
-- ============================================================================

COMMENT ON TABLE public.map IS 'Dynamic maps with sharing, custom domains, and pro features support';
COMMENT ON COLUMN public.map.account_id IS 'Account that owns this map';
COMMENT ON COLUMN public.map.slug IS 'URL-friendly identifier for the map';
COMMENT ON COLUMN public.map.is_public IS 'If true, map is publicly accessible';
COMMENT ON COLUMN public.map.share_token IS 'Unique token for sharing maps via link';
COMMENT ON COLUMN public.map.allow_embedding IS 'If true, map can be embedded in iframes';
COMMENT ON COLUMN public.map.custom_domain IS 'Custom domain for the map (e.g., maps.example.com)';
COMMENT ON COLUMN public.map.custom_domain_verified IS 'Whether the custom domain has been verified';
COMMENT ON COLUMN public.map.requires_pro IS 'If true, only pro/plus subscribers can access';
COMMENT ON COLUMN public.map.pro_features IS 'JSONB object storing pro feature flags and configuration';
COMMENT ON COLUMN public.map.map_config IS 'JSONB object storing Mapbox configuration (style, center, zoom, etc.)';
COMMENT ON COLUMN public.map.map_data IS 'JSONB object storing map data (points, layers, annotations, etc.)';
COMMENT ON COLUMN public.map.is_featured IS 'If true, map is featured (admin only)';

COMMENT ON TABLE public.map_share IS 'Junction table for sharing maps with specific accounts';
COMMENT ON COLUMN public.map_share.permission IS 'Permission level: view (read-only), edit (can modify), admin (full control)';

COMMENT ON FUNCTION public.user_owns_map(UUID) IS 'Checks if the current authenticated user owns the specified map';
COMMENT ON FUNCTION public.user_has_map_access(UUID, public.map_permission) IS 'Checks if the current user has access to a map (owner, shared, or public)';

