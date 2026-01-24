-- Expose billing schema functions to PostgREST
-- PostgREST by default only exposes functions in the public schema
-- This migration creates public wrapper functions and grants permissions

-- ============================================================================
-- Create public wrapper for billing.user_has_feature
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_feature(user_id UUID, feature_slug TEXT)
RETURNS BOOLEAN AS $$
  SELECT billing.user_has_feature(user_id, feature_slug);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- Create public wrapper for billing.get_user_features
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_features(user_id UUID)
RETURNS TABLE(feature_slug TEXT, feature_name TEXT) AS $$
  SELECT * FROM billing.get_user_features(user_id);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.user_has_feature(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_features(UUID) TO authenticated, anon;

-- Also grant on the billing schema functions directly (in case they're called with schema prefix)
GRANT EXECUTE ON FUNCTION billing.user_has_feature(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION billing.get_user_features(UUID) TO authenticated, anon;

-- ============================================================================
-- Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verify functions are accessible
-- ============================================================================

DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if public wrapper exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'user_has_feature'
  ) INTO v_exists;
  
  IF v_exists THEN
    RAISE NOTICE '✅ public.user_has_feature function created successfully';
  ELSE
    RAISE WARNING '❌ public.user_has_feature function not found';
  END IF;
  
  -- Check if billing function exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'billing' 
      AND p.proname = 'user_has_feature'
  ) INTO v_exists;
  
  IF v_exists THEN
    RAISE NOTICE '✅ billing.user_has_feature function exists';
  ELSE
    RAISE WARNING '❌ billing.user_has_feature function not found';
  END IF;
END $$;
