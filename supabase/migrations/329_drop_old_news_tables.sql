-- Drop old news_gen and news_articles tables and related objects
-- Migration 328 created news.prompt and news.generated to replace these

-- ============================================================================
-- Drop old tables (CASCADE removes dependent objects automatically)
-- ============================================================================

DROP TABLE IF EXISTS public.news_articles CASCADE;
DROP TABLE IF EXISTS public.news_gen CASCADE;

-- ============================================================================
-- Drop old functions from migrations 326 and 327
-- ============================================================================

DROP FUNCTION IF EXISTS public.insert_news_articles_from_gen(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_insert_news_articles() CASCADE;
DROP FUNCTION IF EXISTS public.extract_published_date_central(TEXT, TIMESTAMP WITH TIME ZONE) CASCADE;
DROP FUNCTION IF EXISTS public.extract_article_dates(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_news_articles_by_date_range(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_news_count_by_date(DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_dates_with_news(DATE, DATE) CASCADE;

-- ============================================================================
-- Cleanup complete
-- ============================================================================

-- All old news-related objects in public schema have been removed
-- New schema: news.prompt and news.generated are now in use

