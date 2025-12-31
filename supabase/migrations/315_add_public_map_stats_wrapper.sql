-- Add public wrapper functions for analytics.map_views
-- This allows client code to call functions without schema prefix

-- ============================================================================
-- STEP 1: Add public wrapper for get_map_stats
-- ============================================================================

-- Drop existing wrapper if it exists
DROP FUNCTION IF EXISTS public.get_map_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_stats(UUID) CASCADE;

CREATE FUNCTION public.get_map_stats(
  p_map_id UUID,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_map_stats(p_map_id, p_hours);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_map_stats TO anon, authenticated;

COMMENT ON FUNCTION public.get_map_stats IS
  'Public wrapper for analytics.get_map_stats. Returns map statistics: total_views, unique_viewers (accounts + sessions), and accounts_viewed. p_hours filters to last N hours (NULL = all time).';

-- ============================================================================
-- STEP 2: Add public wrapper for record_map_view
-- ============================================================================

-- Drop existing wrapper if it exists
DROP FUNCTION IF EXISTS public.record_map_view(UUID, UUID, TEXT, TEXT, UUID) CASCADE;

CREATE FUNCTION public.record_map_view(
  p_map_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
BEGIN
  RETURN analytics.record_map_view(p_map_id, p_account_id, p_user_agent, p_referrer_url, p_session_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_map_view TO anon, authenticated;

COMMENT ON FUNCTION public.record_map_view IS
  'Public wrapper for analytics.record_map_view. Records a map view and returns the view ID.';

