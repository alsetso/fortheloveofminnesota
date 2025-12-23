-- Enterprise Analytics Backend: Performance Infrastructure & Aggregation System
-- Migration 206: Performance indexes + analytics_aggregates table + aggregation function

-- ============================================================================
-- STEP 1: Performance Indexes for Time-Series Queries
-- ============================================================================

-- Composite index for entity-specific time-series queries (fast chart rendering)
CREATE INDEX IF NOT EXISTS idx_page_views_entity_time_series 
  ON public.page_views(entity_type, entity_id, viewed_at DESC)
  WHERE entity_id IS NOT NULL;

-- Composite index for account-based visitor queries (Pro feature)
CREATE INDEX IF NOT EXISTS idx_page_views_account_entity_time
  ON public.page_views(account_id, entity_type, entity_id, viewed_at DESC)
  WHERE account_id IS NOT NULL;

-- Composite index for session-based visitor tracking
CREATE INDEX IF NOT EXISTS idx_page_views_session_entity
  ON public.page_views(session_id, entity_type, entity_id, viewed_at DESC)
  WHERE session_id IS NOT NULL;

-- Index for date-range queries (used by aggregation function)
CREATE INDEX IF NOT EXISTS idx_page_views_date_entity
  ON public.page_views(DATE(viewed_at), entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Analytics Aggregates Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  date DATE NOT NULL,
  hour INTEGER, -- 0-23 for hourly aggregates, NULL for daily aggregates
  total_views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  unique_accounts INTEGER NOT NULL DEFAULT 0,
  anonymous_visitors INTEGER NOT NULL DEFAULT 0,
  avg_time_on_page INTEGER, -- seconds
  bounce_rate DECIMAL(5,2), -- percentage (0-100)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique aggregates per entity/date/hour combination
  CONSTRAINT analytics_aggregates_unique UNIQUE(entity_type, entity_id, date, hour),
  
  -- Validate hour range
  CONSTRAINT analytics_aggregates_hour_check CHECK (hour IS NULL OR (hour >= 0 AND hour <= 23))
);

-- Indexes for fast time-series queries
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_entity_date 
  ON public.analytics_aggregates(entity_type, entity_id, date DESC)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_date 
  ON public.analytics_aggregates(date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_entity_type_date
  ON public.analytics_aggregates(entity_type, date DESC);

-- ============================================================================
-- STEP 3: Aggregation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.aggregate_page_views(
  p_start_date DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Insert/update daily aggregates from raw page_views
  INSERT INTO public.analytics_aggregates (
    entity_type, 
    entity_id, 
    date, 
    hour,
    total_views, 
    unique_visitors, 
    unique_accounts, 
    anonymous_visitors,
    avg_time_on_page,
    updated_at
  )
  SELECT 
    entity_type,
    entity_id,
    DATE(viewed_at) as date,
    NULL as hour, -- Daily aggregates only
    COUNT(*) as total_views,
    COUNT(DISTINCT COALESCE(account_id::text, session_id::text)) as unique_visitors,
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL) as unique_accounts,
    COUNT(DISTINCT session_id) FILTER (WHERE account_id IS NULL AND session_id IS NOT NULL) as anonymous_visitors,
    AVG(time_on_page)::INTEGER as avg_time_on_page
  FROM public.page_views
  WHERE DATE(viewed_at) BETWEEN p_start_date AND p_end_date
    AND entity_id IS NOT NULL
  GROUP BY entity_type, entity_id, DATE(viewed_at)
  ON CONFLICT (entity_type, entity_id, date, hour) 
  DO UPDATE SET
    total_views = EXCLUDED.total_views,
    unique_visitors = EXCLUDED.unique_visitors,
    unique_accounts = EXCLUDED.unique_accounts,
    anonymous_visitors = EXCLUDED.anonymous_visitors,
    avg_time_on_page = EXCLUDED.avg_time_on_page,
    updated_at = NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.aggregate_page_views IS 
  'Aggregates raw page_views into daily analytics_aggregates for fast time-series queries. Returns the number of aggregate records created/updated.';

-- ============================================================================
-- STEP 4: RLS Policies for analytics_aggregates
-- ============================================================================

-- Enable RLS
ALTER TABLE public.analytics_aggregates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view aggregates for their own entities
CREATE POLICY "analytics_aggregates_select_own" ON public.analytics_aggregates
  FOR SELECT
  USING (
    -- For account entities, user must own the account
    (entity_type = 'account' AND entity_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )) OR
    -- For post entities, user must own the post
    (entity_type = 'post' AND entity_id IN (
      SELECT id FROM public.posts WHERE account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    )) OR
    -- For map_pin entities, user must own the pin
    (entity_type = 'map_pin' AND entity_id IN (
      SELECT id FROM public.map_pins WHERE account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    ))
  );




