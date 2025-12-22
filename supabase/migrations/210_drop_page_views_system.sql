-- Drop page_views system completely
-- Migration 210: Remove all page_views related tables, functions, triggers, and dependencies

-- ============================================================================
-- STEP 1: Drop Triggers (must be dropped before functions)
-- ============================================================================

DROP TRIGGER IF EXISTS page_views_update_visitor_session ON public.page_views;
DROP TRIGGER IF EXISTS update_page_views_updated_at ON public.page_views;

-- ============================================================================
-- STEP 2: Drop Functions (in dependency order)
-- ============================================================================

-- Drop functions that depend on page_views
DROP FUNCTION IF EXISTS public.record_page_view CASCADE;
DROP FUNCTION IF EXISTS public.increment_page_view CASCADE;
DROP FUNCTION IF EXISTS public.get_page_view CASCADE;
DROP FUNCTION IF EXISTS public.aggregate_page_views CASCADE;
DROP FUNCTION IF EXISTS public.get_entity_visitors CASCADE;
DROP FUNCTION IF EXISTS public.get_time_series_data CASCADE;
DROP FUNCTION IF EXISTS public.get_visitor_visit_history CASCADE;
DROP FUNCTION IF EXISTS public.update_visitor_session CASCADE;
DROP FUNCTION IF EXISTS public.trigger_update_visitor_session CASCADE;
DROP FUNCTION IF EXISTS public.refresh_analytics_visitors CASCADE;
DROP FUNCTION IF EXISTS public.run_daily_analytics_aggregation CASCADE;
DROP FUNCTION IF EXISTS public.backfill_analytics_aggregates CASCADE;

-- ============================================================================
-- STEP 3: Drop Materialized Views
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.analytics_visitors CASCADE;

-- ============================================================================
-- STEP 4: Drop Tables (CASCADE will handle foreign keys and dependencies)
-- ============================================================================

DROP TABLE IF EXISTS public.page_views CASCADE;
DROP TABLE IF EXISTS public.analytics_aggregates CASCADE;

-- Note: visitor_sessions table is kept but the trigger that updates it from page_views is already dropped above

-- ============================================================================
-- STEP 5: Drop Enum Types (if they exist)
-- ============================================================================

DROP TYPE IF EXISTS public.page_entity_type CASCADE;

-- ============================================================================
-- STEP 6: Clean up pg_cron jobs (if extension is available)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Try to unschedule jobs, but don't fail if they don't exist
    BEGIN
      PERFORM cron.unschedule('daily-analytics-aggregation');
    EXCEPTION
      WHEN OTHERS THEN
        -- Job doesn't exist, which is fine
        NULL;
    END;
    
    BEGIN
      PERFORM cron.unschedule('refresh-analytics-visitors');
    EXCEPTION
      WHEN OTHERS THEN
        -- Job doesn't exist, which is fine
        NULL;
    END;
    
    RAISE NOTICE 'Cleaned up analytics cron jobs (if they existed)';
  END IF;
END $$;



