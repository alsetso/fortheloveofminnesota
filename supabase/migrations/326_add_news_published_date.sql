-- Add computed published_date column and functions for date-based news queries
-- This improves performance by enabling indexed date queries instead of JSONB filtering

-- ============================================================================
-- STEP 1: Add published_date column to news_gen table
-- ============================================================================

-- Add a JSONB column to store extracted article dates (for efficient querying)
-- We'll use a generated column approach with a function to extract dates
ALTER TABLE public.news_gen
ADD COLUMN IF NOT EXISTS article_dates JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN public.news_gen.article_dates IS 'Array of date strings (YYYY-MM-DD in Central Time) extracted from articles for efficient date-based queries';

-- ============================================================================
-- STEP 2: Create function to extract published date from article (Central Time)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.extract_published_date_central(
  published_at TEXT,
  fallback_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS DATE AS $$
DECLARE
  v_date DATE;
  v_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Try to parse the publishedAt timestamp
  BEGIN
    v_timestamp := published_at::TIMESTAMP WITH TIME ZONE;
  EXCEPTION
    WHEN OTHERS THEN
      -- If parsing fails, use fallback date (news_gen.created_at)
      IF fallback_date IS NOT NULL THEN
        v_timestamp := fallback_date;
      ELSE
        RETURN NULL;
      END IF;
  END;

  -- Convert to Central Time and extract date
  -- Use AT TIME ZONE to convert UTC to Central Time, then extract date
  SELECT DATE(v_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') INTO v_date;
  
  RETURN v_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.extract_published_date_central IS 
  'Extracts the published date from a timestamp string, converting to Central Time. Falls back to provided date if parsing fails.';

-- ============================================================================
-- STEP 3: Create function to extract all article dates from news_gen record
-- ============================================================================

CREATE OR REPLACE FUNCTION public.extract_article_dates(
  p_news_gen_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_news_gen RECORD;
  v_articles JSONB;
  v_article JSONB;
  v_dates JSONB := '[]'::jsonb;
  v_date DATE;
  v_date_str TEXT;
  v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the news_gen record
  SELECT api_response, created_at INTO v_news_gen
  FROM public.news_gen
  WHERE id = p_news_gen_id;
  
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;
  
  v_articles := v_news_gen.api_response->'articles';
  v_created_at := v_news_gen.created_at;
  
  -- Extract dates from each article
  IF v_articles IS NOT NULL AND jsonb_typeof(v_articles) = 'array' THEN
    FOR v_article IN SELECT * FROM jsonb_array_elements(v_articles)
    LOOP
      -- Extract publishedAt from article
      v_date := public.extract_published_date_central(
        COALESCE(v_article->>'publishedAt', ''),
        v_created_at
      );
      
      IF v_date IS NOT NULL THEN
        v_date_str := v_date::TEXT;
        -- Only add if not already in array
        IF NOT (v_dates @> jsonb_build_array(v_date_str)) THEN
          v_dates := v_dates || jsonb_build_array(v_date_str);
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN v_dates;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.extract_article_dates IS 
  'Extracts all unique published dates (Central Time) from articles in a news_gen record. Returns JSONB array of date strings.';

-- ============================================================================
-- STEP 4: Create function to get articles by date range
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_news_articles_by_date_range(
  p_start_date DATE,
  p_end_date DATE DEFAULT NULL
) RETURNS TABLE (
  article JSONB,
  published_date DATE,
  news_gen_id UUID,
  news_gen_created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_end_date DATE;
BEGIN
  -- Default end_date to start_date if not provided
  v_end_date := COALESCE(p_end_date, p_start_date);
  
  -- Query all news_gen records and extract matching articles
  RETURN QUERY
  WITH news_records AS (
    SELECT 
      id,
      api_response,
      created_at
    FROM public.news_gen
    ORDER BY created_at DESC
  ),
  expanded_articles AS (
    SELECT
      nr.id AS news_gen_id,
      nr.created_at AS news_gen_created_at,
      jsonb_array_elements(nr.api_response->'articles') AS article
    FROM news_records nr
    WHERE nr.api_response->'articles' IS NOT NULL
      AND jsonb_typeof(nr.api_response->'articles') = 'array'
  )
  SELECT
    ea.article,
    public.extract_published_date_central(
      COALESCE(ea.article->>'publishedAt', ''),
      ea.news_gen_created_at
    ) AS published_date,
    ea.news_gen_id,
    ea.news_gen_created_at
  FROM expanded_articles ea
  WHERE public.extract_published_date_central(
    COALESCE(ea.article->>'publishedAt', ''),
    ea.news_gen_created_at
  ) BETWEEN p_start_date AND v_end_date
  ORDER BY published_date DESC, news_gen_created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_news_articles_by_date_range IS 
  'Returns all news articles published within a date range (Central Time). Includes article JSONB, published_date, and source news_gen metadata.';

-- ============================================================================
-- STEP 5: Create function to get article count by date
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_news_count_by_date(
  p_date DATE
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.get_news_articles_by_date_range(p_date, p_date);
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_news_count_by_date IS 
  'Returns the count of news articles published on a specific date (Central Time).';

-- ============================================================================
-- STEP 6: Create function to get dates with news (for calendar highlighting)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dates_with_news(
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  date DATE,
  article_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    published_date AS date,
    COUNT(*)::INTEGER AS article_count
  FROM public.get_news_articles_by_date_range(p_start_date, p_end_date)
  GROUP BY published_date
  ORDER BY published_date;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_dates_with_news IS 
  'Returns all dates within a range that have news articles, with article counts. Used for calendar highlighting.';

-- ============================================================================
-- STEP 7: Create index for article_dates (if we populate it)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_news_gen_article_dates ON public.news_gen USING GIN (article_dates);

-- ============================================================================
-- STEP 8: Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.extract_published_date_central TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.extract_article_dates TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_news_articles_by_date_range TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_news_count_by_date TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_dates_with_news TO authenticated, anon;

