-- Optimize views tracking system for no-guest-account architecture
-- Since guest accounts are removed, we can optimize queries and add indexes

-- ============================================================================
-- STEP 1: Add missing indexes for session_id (anonymous tracking)
-- ============================================================================

-- Session ID index for page_views (anonymous user tracking)
CREATE INDEX IF NOT EXISTS idx_page_views_session_id 
  ON public.page_views(session_id) 
  WHERE session_id IS NOT NULL;

-- Session ID index for pin_views (anonymous user tracking)
CREATE INDEX IF NOT EXISTS idx_pin_views_session_id 
  ON public.pin_views(session_id) 
  WHERE session_id IS NOT NULL;

-- Composite index for anonymous viewer uniqueness queries
CREATE INDEX IF NOT EXISTS idx_page_views_session_page 
  ON public.page_views(session_id, page_url, viewed_at DESC) 
  WHERE account_id IS NULL AND session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pin_views_session_pin 
  ON public.pin_views(session_id, pin_id, viewed_at DESC) 
  WHERE account_id IS NULL AND session_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Optimize stats functions with better query plans
-- ============================================================================

-- Optimize get_page_stats - use more efficient counting
CREATE OR REPLACE FUNCTION public.get_page_stats(
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
      session_id
    FROM public.page_views
    WHERE page_url = p_page_url
      AND (p_hours IS NULL OR viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL)
  )
  SELECT 
    COUNT(*)::BIGINT AS total_views,
    (
      COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL) +
      COUNT(DISTINCT session_id) FILTER (WHERE account_id IS NULL AND session_id IS NOT NULL)
    )::BIGINT AS unique_viewers,
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM filtered_views;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optimize get_pin_stats - use more efficient counting
CREATE OR REPLACE FUNCTION public.get_pin_stats(
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
      session_id
    FROM public.pin_views
    WHERE pin_id = p_pin_id
      AND (p_hours IS NULL OR viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL)
  )
  SELECT 
    COUNT(*)::BIGINT AS total_views,
    (
      COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL) +
      COUNT(DISTINCT session_id) FILTER (WHERE account_id IS NULL AND session_id IS NOT NULL)
    )::BIGINT AS unique_viewers,
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM filtered_views;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Add partial index for authenticated-only queries (most common case)
-- ============================================================================

-- Most queries filter by account_id IS NOT NULL, so optimize for that
CREATE INDEX IF NOT EXISTS idx_page_views_authenticated 
  ON public.page_views(account_id, page_url, viewed_at DESC) 
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pin_views_authenticated 
  ON public.pin_views(account_id, pin_id, viewed_at DESC) 
  WHERE account_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Add comments explaining optimization strategy
-- ============================================================================

COMMENT ON INDEX idx_page_views_session_id IS
  'Index for anonymous user tracking via session_id. Used when account_id IS NULL.';

COMMENT ON INDEX idx_pin_views_session_id IS
  'Index for anonymous user tracking via session_id. Used when account_id IS NULL.';

COMMENT ON INDEX idx_page_views_authenticated IS
  'Optimized index for authenticated user queries (most common case). Partial index excludes NULL account_id.';

COMMENT ON INDEX idx_pin_views_authenticated IS
  'Optimized index for authenticated user queries (most common case). Partial index excludes NULL account_id.';




