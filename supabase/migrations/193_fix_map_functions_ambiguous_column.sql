-- Fix ambiguous column reference in map functions
-- Drop and recreate functions with p_map_id parameter name to avoid conflicts

-- ============================================================================
-- STEP 1: Drop existing functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.user_owns_map(UUID);
DROP FUNCTION IF EXISTS public.user_has_map_access(UUID, public.map_permission);

-- ============================================================================
-- STEP 2: Recreate functions with p_map_id parameter
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

-- ============================================================================
-- STEP 3: Ensure functions are owned by postgres (required for SECURITY DEFINER)
-- ============================================================================

ALTER FUNCTION public.user_owns_map(UUID) OWNER TO postgres;
ALTER FUNCTION public.user_has_map_access(UUID, public.map_permission) OWNER TO postgres;

-- ============================================================================
-- STEP 4: Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.user_owns_map(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_map_access(UUID, public.map_permission) TO authenticated, anon;


