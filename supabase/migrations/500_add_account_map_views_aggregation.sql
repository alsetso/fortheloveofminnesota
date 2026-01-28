-- Create function to get aggregated map views for an account
-- Used by billing/views-usage API endpoint

-- ============================================================================
-- STEP 1: Ensure analytics schema exists
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- STEP 2: Create function for aggregated map views
-- ============================================================================

DROP FUNCTION IF EXISTS analytics.get_account_map_views(UUID, TEXT, INTEGER, INTEGER) CASCADE;

CREATE FUNCTION analytics.get_account_map_views(
  p_account_id UUID,
  p_date_range TEXT DEFAULT '30', -- '30', '90', or 'all'
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  map_id UUID,
  map_name TEXT,
  map_slug TEXT,
  view_count BIGINT,
  last_viewed TIMESTAMP WITH TIME ZONE,
  first_viewed TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_date_filter TEXT;
BEGIN
  -- Execute aggregated query with date filtering
  RETURN QUERY
  SELECT 
    m.id AS map_id,
    m.name AS map_name,
    m.slug AS map_slug,
    COUNT(*)::BIGINT AS view_count,
    MAX(mv.viewed_at) AS last_viewed,
    MIN(mv.viewed_at) AS first_viewed
  FROM analytics.map_views mv
  INNER JOIN public.map m ON m.id = mv.map_id
  WHERE mv.account_id = p_account_id
    AND m.is_active = true
    AND (
      p_date_range = 'all' OR
      (p_date_range = '30' AND mv.viewed_at >= NOW() - INTERVAL '30 days') OR
      (p_date_range = '90' AND mv.viewed_at >= NOW() - INTERVAL '90 days')
    )
  GROUP BY m.id, m.name, m.slug
  ORDER BY MAX(mv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Create function for total count
-- ============================================================================

DROP FUNCTION IF EXISTS analytics.get_account_map_views_count(UUID, TEXT) CASCADE;

CREATE FUNCTION analytics.get_account_map_views_count(
  p_account_id UUID,
  p_date_range TEXT DEFAULT '30'
)
RETURNS TABLE (
  total_count BIGINT,
  total_views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT mv.map_id)::BIGINT AS total_count,
    COUNT(*)::BIGINT AS total_views
  FROM analytics.map_views mv
  INNER JOIN public.map m ON m.id = mv.map_id
  WHERE mv.account_id = p_account_id
    AND m.is_active = true
    AND (
      p_date_range = 'all' OR
      (p_date_range = '30' AND mv.viewed_at >= NOW() - INTERVAL '30 days') OR
      (p_date_range = '90' AND mv.viewed_at >= NOW() - INTERVAL '90 days')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Create public wrapper functions (Supabase RPC requires public schema)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_account_map_views(UUID, TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_account_map_views_count(UUID, TEXT) CASCADE;

CREATE FUNCTION public.get_account_map_views(
  p_account_id UUID,
  p_date_range TEXT DEFAULT '30',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  map_id UUID,
  map_name TEXT,
  map_slug TEXT,
  view_count BIGINT,
  last_viewed TIMESTAMP WITH TIME ZONE,
  first_viewed TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_account_map_views(p_account_id, p_date_range, p_limit, p_offset);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION public.get_account_map_views_count(
  p_account_id UUID,
  p_date_range TEXT DEFAULT '30'
)
RETURNS TABLE (
  total_count BIGINT,
  total_views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_account_map_views_count(p_account_id, p_date_range);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION analytics.get_account_map_views TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_account_map_views_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_map_views TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_map_views_count TO authenticated;

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON FUNCTION analytics.get_account_map_views IS
  'Returns aggregated map views for an account. Groups by map_id with COUNT, MAX, MIN. Supports date filtering (30/90/all days) and pagination.';

COMMENT ON FUNCTION analytics.get_account_map_views_count IS
  'Returns total count of distinct maps and total views for an account. Supports date filtering (30/90/all days).';
