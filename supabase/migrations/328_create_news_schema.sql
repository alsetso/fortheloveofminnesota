-- Create news schema and migrate from public.news_gen to news.prompt and news.generated
-- This provides better organization, simpler structure, and cleaner separation

-- ============================================================================
-- STEP 1: Create news schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS news;

COMMENT ON SCHEMA news IS 'News generation and article storage schema';

-- ============================================================================
-- STEP 2: Create prompt table (replaces public.news_gen)
-- ============================================================================

CREATE TABLE news.prompt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_input TEXT NOT NULL,
  api_response JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prompt_account_id ON news.prompt(account_id);
CREATE INDEX idx_prompt_created_at ON news.prompt(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_prompt_updated_at 
  BEFORE UPDATE ON news.prompt 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE news.prompt IS 'Stores news generation prompts and API responses';
COMMENT ON COLUMN news.prompt.account_id IS 'Account that generated this prompt';
COMMENT ON COLUMN news.prompt.user_input IS 'User-provided search query';
COMMENT ON COLUMN news.prompt.api_response IS 'Full JSON response from RapidAPI';

-- ============================================================================
-- STEP 3: Create generated table (replaces public.news_articles)
-- ============================================================================

CREATE TABLE news.generated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES news.prompt(id) ON DELETE CASCADE,
  
  -- Article identification
  article_id TEXT NOT NULL,
  
  -- Article content
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  snippet TEXT,
  photo_url TEXT,
  thumbnail_url TEXT,
  
  -- Publication metadata
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_date DATE NOT NULL, -- Central Time, indexed for queries
  
  -- Authors and topics
  authors JSONB DEFAULT '[]'::jsonb,
  related_topics JSONB DEFAULT '[]'::jsonb,
  
  -- Source information
  source_url TEXT,
  source_name TEXT,
  source_logo_url TEXT,
  source_favicon_url TEXT,
  source_publication_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: prevent duplicate articles per prompt
  CONSTRAINT generated_article_id_prompt_unique UNIQUE (article_id, prompt_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_generated_published_date ON news.generated(published_date DESC);
CREATE INDEX idx_generated_published_at ON news.generated(published_at DESC);
CREATE INDEX idx_generated_prompt_id ON news.generated(prompt_id);
CREATE INDEX idx_generated_article_id ON news.generated(article_id);
CREATE INDEX idx_generated_source_name ON news.generated(source_name);
CREATE INDEX idx_generated_date_source ON news.generated(published_date DESC, source_name);

-- Updated_at trigger
CREATE TRIGGER update_generated_updated_at 
  BEFORE UPDATE ON news.generated 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE news.generated IS 'Individual news articles extracted from prompts';
COMMENT ON COLUMN news.generated.prompt_id IS 'Reference to the prompt that generated this article';
COMMENT ON COLUMN news.generated.published_date IS 'Publication date in Central Time (indexed)';

-- ============================================================================
-- STEP 4: Create function to extract published date in Central Time
-- ============================================================================

CREATE OR REPLACE FUNCTION news.extract_published_date_central(
  published_at TIMESTAMP WITH TIME ZONE,
  fallback_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS DATE AS $$
DECLARE
  v_date DATE;
BEGIN
  SELECT DATE(published_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') INTO v_date;
  RETURN v_date;
EXCEPTION
  WHEN OTHERS THEN
    IF fallback_date IS NOT NULL THEN
      SELECT DATE(fallback_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') INTO v_date;
      RETURN v_date;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION news.extract_published_date_central IS 
  'Extracts published date from timestamp, converting to Central Time';

-- ============================================================================
-- STEP 5: Create function to extract articles from prompt
-- ============================================================================

CREATE OR REPLACE FUNCTION news.extract_articles_from_prompt(
  p_prompt_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_prompt RECORD;
  v_articles JSONB;
  v_article JSONB;
  v_count INTEGER := 0;
  v_published_at TIMESTAMP WITH TIME ZONE;
  v_published_date DATE;
BEGIN
  -- Get prompt record
  SELECT api_response, created_at INTO v_prompt
  FROM news.prompt
  WHERE id = p_prompt_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prompt not found: %', p_prompt_id;
  END IF;
  
  v_articles := v_prompt.api_response->'articles';
  
  -- Extract and insert each article
  IF v_articles IS NOT NULL AND jsonb_typeof(v_articles) = 'array' THEN
    FOR v_article IN SELECT * FROM jsonb_array_elements(v_articles)
    LOOP
      BEGIN
        -- Parse publishedAt
        BEGIN
          v_published_at := (v_article->>'publishedAt')::TIMESTAMP WITH TIME ZONE;
        EXCEPTION
          WHEN OTHERS THEN
            v_published_at := v_prompt.created_at;
        END;
        
        -- Extract published date
        v_published_date := news.extract_published_date_central(v_published_at, v_prompt.created_at);
        
        -- Insert article
        INSERT INTO news.generated (
          prompt_id,
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
          p_prompt_id,
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
        ON CONFLICT (article_id, prompt_id) DO NOTHING;
        
        v_count := v_count + 1;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to insert article: %', SQLERRM;
      END;
    END LOOP;
  END IF;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION news.extract_articles_from_prompt IS 
  'Extracts articles from prompt and inserts into generated table. Returns count.';

-- ============================================================================
-- STEP 6: Create trigger to auto-extract articles
-- ============================================================================

CREATE OR REPLACE FUNCTION news.trigger_extract_articles()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM news.extract_articles_from_prompt(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_prompt_insert
  AFTER INSERT ON news.prompt
  FOR EACH ROW
  EXECUTE FUNCTION news.trigger_extract_articles();

-- ============================================================================
-- STEP 7: Enable Row Level Security
-- ============================================================================

ALTER TABLE news.prompt ENABLE ROW LEVEL SECURITY;
ALTER TABLE news.generated ENABLE ROW LEVEL SECURITY;

-- Prompt policies: Admins can manage, users can view their own
CREATE POLICY "Users can view own prompts"
  ON news.prompt FOR SELECT
  TO authenticated
  USING (public.user_owns_account(account_id));

CREATE POLICY "Admins can manage prompts"
  ON news.prompt FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Generated policies: Public read, admin write
CREATE POLICY "Anyone can view generated articles"
  ON news.generated FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage generated articles"
  ON news.generated FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA news TO authenticated, anon;
GRANT SELECT ON news.prompt TO authenticated;
GRANT SELECT ON news.generated TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON news.prompt TO authenticated;
GRANT INSERT, UPDATE, DELETE ON news.generated TO authenticated;
GRANT ALL ON SCHEMA news TO service_role;
GRANT ALL ON news.prompt TO service_role;
GRANT ALL ON news.generated TO service_role;

GRANT EXECUTE ON FUNCTION news.extract_published_date_central TO authenticated, anon;
GRANT EXECUTE ON FUNCTION news.extract_articles_from_prompt TO authenticated;

-- ============================================================================
-- STEP 9: Migrate existing data (if public.news_gen exists)
-- ============================================================================

DO $$
DECLARE
  v_old_record RECORD;
  v_new_prompt_id UUID;
  v_count INTEGER;
BEGIN
  -- Check if old table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'news_gen') THEN
    
    -- Migrate each news_gen record
    FOR v_old_record IN 
      SELECT id, account_id, user_input, api_response, created_at, updated_at
      FROM public.news_gen
      ORDER BY created_at
    LOOP
      -- Insert into prompt table
      INSERT INTO news.prompt (id, account_id, user_input, api_response, created_at, updated_at)
      VALUES (v_old_record.id, v_old_record.account_id, v_old_record.user_input, 
              v_old_record.api_response, v_old_record.created_at, v_old_record.updated_at)
      ON CONFLICT DO NOTHING;
      
      v_new_prompt_id := v_old_record.id;
      
      -- Extract articles (trigger will handle this, but we can also call directly)
      SELECT news.extract_articles_from_prompt(v_new_prompt_id) INTO v_count;
      
      RAISE NOTICE 'Migrated prompt % with % articles', v_new_prompt_id, v_count;
    END LOOP;
    
    RAISE NOTICE 'Migration from public.news_gen to news.prompt completed';
  END IF;
END;
$$;

-- ============================================================================
-- STEP 10: Create RPC functions for API access (public schema)
-- ============================================================================

-- Function to get articles by date range (for API routes)
CREATE OR REPLACE FUNCTION public.get_news_by_date_range(
  p_start_date DATE,
  p_end_date DATE DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  prompt_id UUID,
  article_id TEXT,
  title TEXT,
  link TEXT,
  snippet TEXT,
  photo_url TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  published_date DATE,
  authors JSONB,
  source_url TEXT,
  source_name TEXT,
  source_logo_url TEXT,
  source_favicon_url TEXT,
  source_publication_id TEXT,
  related_topics JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.prompt_id,
    g.article_id,
    g.title,
    g.link,
    g.snippet,
    g.photo_url,
    g.thumbnail_url,
    g.published_at,
    g.published_date,
    g.authors,
    g.source_url,
    g.source_name,
    g.source_logo_url,
    g.source_favicon_url,
    g.source_publication_id,
    g.related_topics,
    g.created_at,
    g.updated_at
  FROM news.generated g
  WHERE g.published_date >= p_start_date
    AND (p_end_date IS NULL OR g.published_date <= p_end_date)
  ORDER BY g.published_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_news_by_date_range IS 
  'Returns news articles from news.generated table for a date range. Used by API routes.';

-- Function to get dates with news counts
CREATE OR REPLACE FUNCTION public.get_dates_with_news_counts(
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  date DATE,
  article_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.published_date AS date,
    COUNT(*)::BIGINT AS article_count
  FROM news.generated g
  WHERE g.published_date >= p_start_date
    AND g.published_date <= p_end_date
  GROUP BY g.published_date
  ORDER BY g.published_date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_dates_with_news_counts IS 
  'Returns dates with article counts from news.generated table. Used for calendar highlighting.';

-- Function to get latest prompt
CREATE OR REPLACE FUNCTION public.get_latest_prompt()
RETURNS TABLE (
  id UUID,
  account_id UUID,
  user_input TEXT,
  api_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.account_id,
    p.user_input,
    p.api_response,
    p.created_at,
    p.updated_at
  FROM news.prompt p
  ORDER BY p.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_latest_prompt IS 
  'Returns the most recent prompt from news.prompt table.';

-- Function to check if news generated recently
CREATE OR REPLACE FUNCTION public.has_news_generated_recently()
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_twenty_four_hours_ago TIMESTAMP WITH TIME ZONE;
BEGIN
  v_twenty_four_hours_ago := NOW() - INTERVAL '24 hours';
  
  SELECT COUNT(*) INTO v_count
  FROM news.prompt p
  WHERE p.created_at >= v_twenty_four_hours_ago;
  
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.has_news_generated_recently IS 
  'Returns true if a prompt was created in the last 24 hours.';

-- Function to insert prompt (returns the inserted record)
CREATE OR REPLACE FUNCTION public.insert_prompt(
  p_account_id UUID,
  p_user_input TEXT,
  p_api_response JSONB
) RETURNS TABLE (
  id UUID,
  account_id UUID,
  user_input TEXT,
  api_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_prompt_id UUID;
BEGIN
  INSERT INTO news.prompt (account_id, user_input, api_response)
  VALUES (p_account_id, p_user_input, p_api_response)
  RETURNING news.prompt.id INTO v_prompt_id;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.account_id,
    p.user_input,
    p.api_response,
    p.created_at,
    p.updated_at
  FROM news.prompt p
  WHERE p.id = v_prompt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.insert_prompt IS 
  'Inserts a new prompt into news.prompt. Trigger automatically extracts articles to news.generated.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_news_by_date_range TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_dates_with_news_counts TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_prompt TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_news_generated_recently TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.insert_prompt TO authenticated;

-- ============================================================================
-- STEP 11: Update auto_generate_news function to use new schema
-- ============================================================================

-- Update the function if it exists (from migration 294)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auto_generate_news') THEN
    -- Drop old function
    DROP FUNCTION IF EXISTS public.auto_generate_news();
    
    -- Create new version using news schema
    CREATE OR REPLACE FUNCTION public.auto_generate_news()
    RETURNS JSONB AS $$
    DECLARE
      v_account_id UUID;
      v_api_key TEXT;
      v_url TEXT;
      v_response JSONB;
      v_articles JSONB;
      v_result JSONB;
    BEGIN
      -- Get admin account ID (first admin account)
      SELECT id INTO v_account_id
      FROM public.accounts
      WHERE role = 'admin'
      LIMIT 1;
      
      IF v_account_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No admin account found');
      END IF;
      
      -- Get API key from environment
      v_api_key := current_setting('app.rapidapi_key', true);
      IF v_api_key IS NULL OR v_api_key = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'RapidAPI key not configured');
      END IF;
      
      -- Build API URL
      v_url := 'https://real-time-news-data.p.rapidapi.com/search?q=Minnesota%2C%20MN&lang=en&country=US&time_published=1d';
      
      -- Make API call
      BEGIN
        SELECT content::JSONB INTO v_response
        FROM http((
          'GET',
          v_url,
          ARRAY[
            http_header('x-rapidapi-host', 'real-time-news-data.p.rapidapi.com'),
            http_header('x-rapidapi-key', v_api_key)
          ],
          NULL,
          NULL
        )::http_request);
        
        -- Parse response and save to news.prompt
        IF v_response->>'status' = 'OK' THEN
          v_articles := v_response->'data';
          
          -- Insert into news.prompt (trigger will extract articles)
          INSERT INTO news.prompt (account_id, user_input, api_response)
          VALUES (
            v_account_id,
            'Minnesota, MN',
            jsonb_build_object(
              'requestId', v_response->>'request_id',
              'articles', v_articles,
              'count', jsonb_array_length(v_articles),
              'query', 'Minnesota, MN',
              'timePublished', '1d',
              'country', 'US',
              'lang', 'en',
              'generatedAt', NOW()::TEXT
            )
          )
          RETURNING jsonb_build_object('id', id, 'success', true) INTO v_result;
          
          RETURN v_result;
        ELSE
          RETURN jsonb_build_object(
            'success', false,
            'error', 'API returned non-OK status',
            'response', v_response
          );
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to generate news: %', SQLERRM;
          RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
          );
      END;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    COMMENT ON FUNCTION public.auto_generate_news IS 
      'Generates news by calling RapidAPI and saving to news.prompt. Trigger auto-extracts to news.generated.';
  END IF;
END;
$$;

-- ============================================================================
-- STEP 11: Cleanup
-- ============================================================================

-- Old tables and functions are dropped in migration 329_drop_old_news_tables.sql
-- This keeps the migration order clean and allows verification before cleanup

