-- Enterprise Analytics Backend: Visitor Identity System
-- Migration 207: Visitor functions + materialized view

-- ============================================================================
-- STEP 1: Materialized View for Fast Visitor Lookups
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.analytics_visitors AS
SELECT 
  entity_type,
  entity_id,
  account_id,
  session_id,
  COUNT(*) as visit_count,
  MIN(viewed_at) as first_visit,
  MAX(viewed_at) as last_visit,
  AVG(time_on_page) as avg_time_on_page,
  COUNT(DISTINCT DATE(viewed_at)) as days_visited,
  COUNT(DISTINCT referrer_url) FILTER (WHERE referrer_url IS NOT NULL) as unique_referrers
FROM public.page_views
WHERE (account_id IS NOT NULL OR session_id IS NOT NULL)
  AND entity_id IS NOT NULL
GROUP BY entity_type, entity_id, account_id, session_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS analytics_visitors_unique_idx
  ON public.analytics_visitors(entity_type, entity_id, account_id, session_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS analytics_visitors_entity_idx
  ON public.analytics_visitors(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS analytics_visitors_account_idx
  ON public.analytics_visitors(account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS analytics_visitors_last_visit_idx
  ON public.analytics_visitors(last_visit DESC);

-- ============================================================================
-- STEP 2: Get Entity Visitors Function (Pro Feature)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_entity_visitors(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  account_id UUID,
  username TEXT,
  display_name TEXT,
  visit_count BIGINT,
  first_visit TIMESTAMP WITH TIME ZONE,
  last_visit TIMESTAMP WITH TIME ZONE,
  avg_time_on_page NUMERIC,
  days_visited BIGINT,
  unique_referrers BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    av.account_id,
    a.username,
    COALESCE(
      NULLIF(TRIM(a.first_name || ' ' || a.last_name), ''),
      a.username,
      'Anonymous'
    ) as display_name,
    av.visit_count,
    av.first_visit,
    av.last_visit,
    av.avg_time_on_page,
    av.days_visited,
    av.unique_referrers
  FROM public.analytics_visitors av
  LEFT JOIN public.accounts a ON av.account_id = a.id
  WHERE av.entity_type = p_entity_type
    AND av.entity_id = p_entity_id
    AND (p_date_from IS NULL OR DATE(av.first_visit) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(av.last_visit) <= p_date_to)
  ORDER BY av.visit_count DESC, av.last_visit DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_entity_visitors IS 
  'Returns visitor details for a specific entity. Used by Pro-tier analytics to show who visited.';

-- ============================================================================
-- STEP 3: Get Time-Series Data Function (Pro Feature)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_time_series_data(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_date_from DATE,
  p_date_to DATE,
  p_period TEXT DEFAULT 'daily' -- 'daily', 'weekly', 'monthly'
)
RETURNS TABLE (
  date DATE,
  views INTEGER,
  unique_visitors INTEGER,
  unique_accounts INTEGER,
  anonymous_visitors INTEGER,
  avg_time_on_page INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aa.date,
    SUM(aa.total_views)::INTEGER as views,
    SUM(aa.unique_visitors)::INTEGER as unique_visitors,
    SUM(aa.unique_accounts)::INTEGER as unique_accounts,
    SUM(aa.anonymous_visitors)::INTEGER as anonymous_visitors,
    AVG(aa.avg_time_on_page)::INTEGER as avg_time_on_page
  FROM public.analytics_aggregates aa
  WHERE aa.entity_type = p_entity_type
    AND aa.entity_id = p_entity_id
    AND aa.date BETWEEN p_date_from AND p_date_to
    AND aa.hour IS NULL -- Daily aggregates only
  GROUP BY aa.date
  ORDER BY aa.date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_time_series_data IS 
  'Returns time-series data for charts. Aggregates daily data points for visualization.';

-- ============================================================================
-- STEP 4: Get Visitor Visit History Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_visitor_visit_history(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  viewed_at TIMESTAMP WITH TIME ZONE,
  referrer_url TEXT,
  time_on_page INTEGER,
  user_agent TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.viewed_at,
    pv.referrer_url,
    pv.time_on_page,
    pv.user_agent
  FROM public.page_views pv
  WHERE pv.entity_type = p_entity_type
    AND pv.entity_id = p_entity_id
    AND (
      (p_account_id IS NOT NULL AND pv.account_id = p_account_id) OR
      (p_session_id IS NOT NULL AND pv.session_id = p_session_id)
    )
  ORDER BY pv.viewed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_visitor_visit_history IS 
  'Returns detailed visit history for a specific visitor (account or session).';

