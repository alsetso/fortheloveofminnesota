-- Fix unique visitors counting to use device_id instead of session_id
-- Changes counting logic: one device = 1 unique visitor (regardless of tabs or login status)
-- Device ID is stored in session_id column but comes from localStorage (shared across tabs)

-- ============================================================================
-- STEP 1: Update get_page_stats function to count by device_id
-- ============================================================================

CREATE OR REPLACE FUNCTION analytics.get_page_stats(
  p_page_url TEXT,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_views AS (
    SELECT 
      account_id,
      session_id -- This now stores device_id (from localStorage, shared across tabs)
    FROM analytics.page_views
    WHERE page_url = p_page_url
      AND (p_hours IS NULL OR viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL)
  )
  SELECT 
    COUNT(*)::BIGINT AS total_views,
    -- Count distinct device_ids (stored in session_id column)
    -- One device = 1 unique visitor, regardless of login status or tabs
    COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL)::BIGINT AS unique_viewers,
    -- Still track distinct accounts for accounts_viewed metric
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM filtered_views;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Update get_pin_stats function with same logic
-- ============================================================================

CREATE OR REPLACE FUNCTION analytics.get_pin_stats(
  p_pin_id UUID,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_views AS (
    SELECT 
      account_id,
      session_id -- This now stores device_id (from localStorage, shared across tabs)
    FROM analytics.pin_views
    WHERE pin_id = p_pin_id
      AND (p_hours IS NULL OR viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL)
  )
  SELECT 
    COUNT(*)::BIGINT AS total_views,
    -- Count distinct device_ids (stored in session_id column)
    -- One device = 1 unique visitor, regardless of login status or tabs
    COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL)::BIGINT AS unique_viewers,
    -- Still track distinct accounts for accounts_viewed metric
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM filtered_views;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Update public wrapper functions (if they exist)
-- ============================================================================

-- Update public.get_page_stats wrapper to use updated analytics function
CREATE OR REPLACE FUNCTION public.get_page_stats(
  p_page_url TEXT,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_page_stats(p_page_url, p_hours);
END;
$$;

-- Update public.get_pin_stats wrapper to use updated analytics function
CREATE OR REPLACE FUNCTION public.get_pin_stats(
  p_pin_id UUID,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_pin_stats(p_pin_id, p_hours);
END;
$$;

-- ============================================================================
-- STEP 4: Update comments
-- ============================================================================

COMMENT ON FUNCTION analytics.get_page_stats IS
  'Returns page statistics: total_views, unique_viewers (counted by device_id - one device = 1 unique visitor regardless of tabs or login status), and accounts_viewed. p_hours filters to last N hours (NULL = all time).';

COMMENT ON FUNCTION analytics.get_pin_stats IS
  'Returns pin statistics: total_views, unique_viewers (counted by device_id - one device = 1 unique visitor regardless of tabs or login status), and accounts_viewed. p_hours filters to last N hours (NULL = all time).';

COMMENT ON FUNCTION public.get_page_stats IS
  'Public wrapper for analytics.get_page_stats. Returns page statistics counted by device_id.';

COMMENT ON FUNCTION public.get_pin_stats IS
  'Public wrapper for analytics.get_pin_stats. Returns pin statistics counted by device_id.';
