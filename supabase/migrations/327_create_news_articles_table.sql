-- Create news_articles table and migrate from JSONB to normalized structure
-- This provides better performance, simpler queries, and proper indexing

-- ============================================================================
-- STEP 1: Create news_articles table
-- ============================================================================

CREATE TABLE public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_gen_id UUID NOT NULL REFERENCES public.news_gen(id) ON DELETE CASCADE,
  
  -- Article identification
  article_id TEXT NOT NULL, -- Original article_id from API (for deduplication)
  
  -- Article content
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  snippet TEXT,
  photo_url TEXT,
  thumbnail_url TEXT,
  
  -- Publication metadata
  published_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Original UTC timestamp
  published_date DATE NOT NULL, -- Date in Central Time (indexed for queries)
  
  -- Authors (stored as JSONB array)
  authors JSONB DEFAULT '[]'::jsonb,
  
  -- Source information
  source_url TEXT,
  source_name TEXT,
  source_logo_url TEXT,
  source_favicon_url TEXT,
  source_publication_id TEXT,
  
  -- Related topics (stored as JSONB array)
  related_topics JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: same article_id can't be inserted twice for same news_gen
  CONSTRAINT news_articles_article_id_news_gen_unique UNIQUE (article_id, news_gen_id)
);

-- ============================================================================
-- STEP 2: Create indexes for efficient queries
-- ============================================================================

-- Index for date-based queries (most important)
CREATE INDEX idx_news_articles_published_date ON public.news_articles(published_date DESC);
CREATE INDEX idx_news_articles_published_at ON public.news_articles(published_at DESC);

-- Index for news_gen relationship
CREATE INDEX idx_news_articles_news_gen_id ON public.news_articles(news_gen_id);

-- Index for article_id lookups
CREATE INDEX idx_news_articles_article_id ON public.news_articles(article_id);

-- Index for source queries
CREATE INDEX idx_news_articles_source_name ON public.news_articles(source_name);

-- Composite index for date range queries with source
CREATE INDEX idx_news_articles_date_source ON public.news_articles(published_date DESC, source_name);

-- ============================================================================
-- STEP 3: Create function to extract published date in Central Time
-- ============================================================================

CREATE OR REPLACE FUNCTION public.extract_published_date_central(
  published_at TIMESTAMP WITH TIME ZONE,
  fallback_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS DATE AS $$
DECLARE
  v_date DATE;
BEGIN
  -- Convert UTC timestamp to Central Time and extract date
  SELECT DATE(published_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') INTO v_date;
  
  RETURN v_date;
EXCEPTION
  WHEN OTHERS THEN
    -- If conversion fails, use fallback date
    IF fallback_date IS NOT NULL THEN
      SELECT DATE(fallback_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') INTO v_date;
      RETURN v_date;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.extract_published_date_central IS 
  'Extracts the published date from a timestamp, converting to Central Time. Falls back to provided date if conversion fails.';

-- ============================================================================
-- STEP 4: Create function to insert articles from news_gen
-- ============================================================================

CREATE OR REPLACE FUNCTION public.insert_news_articles_from_gen(
  p_news_gen_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_news_gen RECORD;
  v_articles JSONB;
  v_article JSONB;
  v_inserted_count INTEGER := 0;
  v_published_at TIMESTAMP WITH TIME ZONE;
  v_published_date DATE;
  v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the news_gen record
  SELECT api_response, created_at INTO v_news_gen
  FROM public.news_gen
  WHERE id = p_news_gen_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'news_gen record not found: %', p_news_gen_id;
  END IF;
  
  v_articles := v_news_gen.api_response->'articles';
  v_created_at := v_news_gen.created_at;
  
  -- Extract and insert each article
  IF v_articles IS NOT NULL AND jsonb_typeof(v_articles) = 'array' THEN
    FOR v_article IN SELECT * FROM jsonb_array_elements(v_articles)
    LOOP
      BEGIN
        -- Parse publishedAt timestamp
        BEGIN
          v_published_at := (v_article->>'publishedAt')::TIMESTAMP WITH TIME ZONE;
        EXCEPTION
          WHEN OTHERS THEN
            -- If parsing fails, use news_gen created_at as fallback
            v_published_at := v_created_at;
        END;
        
        -- Extract published date in Central Time
        v_published_date := public.extract_published_date_central(v_published_at, v_created_at);
        
        -- Insert article (using ON CONFLICT to handle duplicates)
        INSERT INTO public.news_articles (
          news_gen_id,
          article_id,
          title,
          link,
          snippet,
          photo_url,
          thumbnail_url,
          published_at,
          published_date,
          authors,
          source_url,
          source_name,
          source_logo_url,
          source_favicon_url,
          source_publication_id,
          related_topics
        ) VALUES (
          p_news_gen_id,
          COALESCE(v_article->>'id', gen_random_uuid()::TEXT),
          COALESCE(v_article->>'title', 'Untitled'),
          COALESCE(v_article->>'link', ''),
          v_article->>'snippet',
          v_article->>'photoUrl',
          v_article->>'thumbnailUrl',
          v_published_at,
          v_published_date,
          COALESCE(v_article->'authors', '[]'::jsonb),
          v_article->'source'->>'url',
          v_article->'source'->>'name',
          v_article->'source'->>'logoUrl',
          v_article->'source'->>'faviconUrl',
          v_article->'source'->>'publicationId',
          COALESCE(v_article->'relatedTopics', '[]'::jsonb)
        )
        ON CONFLICT (article_id, news_gen_id) DO NOTHING;
        
        v_inserted_count := v_inserted_count + 1;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but continue with next article
          RAISE WARNING 'Failed to insert article: %, Error: %', v_article->>'title', SQLERRM;
      END;
    END LOOP;
  END IF;
  
  RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.insert_news_articles_from_gen IS 
  'Extracts articles from a news_gen record and inserts them into news_articles table. Returns count of inserted articles.';

-- ============================================================================
-- STEP 5: Create trigger to automatically insert articles when news_gen is created
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_insert_news_articles()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically extract and insert articles
  PERFORM public.insert_news_articles_from_gen(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_news_gen_insert
  AFTER INSERT ON public.news_gen
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_insert_news_articles();

COMMENT ON TRIGGER after_news_gen_insert ON public.news_gen IS 
  'Automatically extracts and inserts articles into news_articles table when a news_gen record is created.';

-- ============================================================================
-- STEP 6: Create updated_at trigger for news_articles
-- ============================================================================

CREATE TRIGGER update_news_articles_updated_at 
  BEFORE UPDATE ON public.news_articles 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 7: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view articles (public data)
CREATE POLICY "Anyone can view news articles"
  ON public.news_articles
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Admins can manage news articles"
  ON public.news_articles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT SELECT ON public.news_articles TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.news_articles TO authenticated;
GRANT ALL ON public.news_articles TO service_role;

GRANT EXECUTE ON FUNCTION public.extract_published_date_central TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.insert_news_articles_from_gen TO authenticated;

-- ============================================================================
-- STEP 9: Migrate existing data (if any)
-- ============================================================================

-- Migrate existing news_gen records to articles table
DO $$
DECLARE
  v_news_gen RECORD;
  v_count INTEGER;
BEGIN
  FOR v_news_gen IN SELECT id FROM public.news_gen ORDER BY created_at
  LOOP
    SELECT public.insert_news_articles_from_gen(v_news_gen.id) INTO v_count;
    RAISE NOTICE 'Migrated % articles from news_gen %', v_count, v_news_gen.id;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 10: Add comments
-- ============================================================================

COMMENT ON TABLE public.news_articles IS 'Individual news articles extracted from news_gen batches. Normalized structure for efficient date-based queries.';
COMMENT ON COLUMN public.news_articles.news_gen_id IS 'Reference to the news_gen batch this article belongs to';
COMMENT ON COLUMN public.news_articles.article_id IS 'Original article ID from API (for deduplication)';
COMMENT ON COLUMN public.news_articles.published_at IS 'Original publication timestamp in UTC';
COMMENT ON COLUMN public.news_articles.published_date IS 'Publication date in Central Time (indexed for efficient queries)';

