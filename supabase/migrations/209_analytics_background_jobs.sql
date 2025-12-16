-- Enterprise Analytics Backend: Background Processing
-- Migration 209: Scheduled jobs for aggregation and materialized view refresh

-- ============================================================================
-- STEP 1: Function to Refresh Materialized View Concurrently
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_analytics_visitors()
RETURNS VOID AS $$
BEGIN
  -- Refresh materialized view concurrently (non-blocking)
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.analytics_visitors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.refresh_analytics_visitors IS 
  'Refreshes the analytics_visitors materialized view. Should be run daily to keep visitor data current.';

-- ============================================================================
-- STEP 2: Function to Run Daily Aggregation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_daily_analytics_aggregation()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Aggregate yesterday's data (run in morning for previous day)
  SELECT public.aggregate_page_views(
    CURRENT_DATE - INTERVAL '1 day',
    CURRENT_DATE - INTERVAL '1 day'
  ) INTO v_count;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.run_daily_analytics_aggregation IS 
  'Runs daily aggregation for the previous day. Should be scheduled to run daily at 1 AM.';

-- ============================================================================
-- STEP 3: Function to Backfill Aggregates (One-time)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.backfill_analytics_aggregates(
  p_days_back INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Backfill aggregates for the last N days
  SELECT public.aggregate_page_views(
    CURRENT_DATE - (p_days_back || ' days')::INTERVAL,
    CURRENT_DATE - INTERVAL '1 day'
  ) INTO v_count;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.backfill_analytics_aggregates IS 
  'Backfills analytics aggregates for historical data. Useful for initial setup or data recovery.';

-- ============================================================================
-- STEP 4: pg_cron Job Setup (if extension is available)
-- ============================================================================

-- Note: pg_cron extension must be enabled in Supabase dashboard
-- These commands will fail gracefully if pg_cron is not available

-- Schedule daily aggregation (runs at 1 AM UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('daily-analytics-aggregation');
    
    -- Schedule new job
    PERFORM cron.schedule(
      'daily-analytics-aggregation',
      '0 1 * * *', -- Daily at 1 AM UTC
      $$SELECT public.run_daily_analytics_aggregation()$$
    );
    
    RAISE NOTICE 'Scheduled daily analytics aggregation job';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Jobs must be scheduled externally.';
  END IF;
END $$;

-- Schedule materialized view refresh (runs at 2 AM UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('refresh-analytics-visitors');
    
    -- Schedule new job
    PERFORM cron.schedule(
      'refresh-analytics-visitors',
      '0 2 * * *', -- Daily at 2 AM UTC
      $$SELECT public.refresh_analytics_visitors()$$
    );
    
    RAISE NOTICE 'Scheduled analytics visitors refresh job';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Jobs must be scheduled externally.';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Manual Execution Instructions
-- ============================================================================

-- If pg_cron is not available, these functions can be called manually:
-- 
-- Daily aggregation (run via external scheduler or Supabase Edge Functions):
--   SELECT public.run_daily_analytics_aggregation();
--
-- Materialized view refresh (run via external scheduler):
--   SELECT public.refresh_analytics_visitors();
--
-- Backfill historical data (one-time):
--   SELECT public.backfill_analytics_aggregates(30); -- Last 30 days

