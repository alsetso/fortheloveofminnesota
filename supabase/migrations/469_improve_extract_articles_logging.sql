-- Improve extract_articles_from_prompt with better error handling and logging

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
  v_article_title TEXT;
BEGIN
  -- Get prompt record
  SELECT api_response, created_at INTO v_prompt
  FROM news.prompt
  WHERE id = p_prompt_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prompt not found: %', p_prompt_id;
  END IF;
  
  v_articles := v_prompt.api_response->'articles';
  
  -- Log what we found
  IF v_articles IS NULL THEN
    RAISE WARNING 'No articles key found in api_response for prompt %', p_prompt_id;
    RETURN 0;
  END IF;
  
  IF jsonb_typeof(v_articles) != 'array' THEN
    RAISE WARNING 'Articles is not an array (type: %) for prompt %', jsonb_typeof(v_articles), p_prompt_id;
    RETURN 0;
  END IF;
  
  IF jsonb_array_length(v_articles) = 0 THEN
    RAISE WARNING 'Articles array is empty for prompt %', p_prompt_id;
    RETURN 0;
  END IF;
  
  -- Extract and insert each article
  FOR v_article IN SELECT * FROM jsonb_array_elements(v_articles)
  LOOP
    BEGIN
      -- Get article title for error messages
      v_article_title := COALESCE(v_article->>'title', 'Untitled');
      
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
        RAISE WARNING 'Failed to insert article "%": %', v_article_title, SQLERRM;
    END;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION news.extract_articles_from_prompt IS 
  'Extracts articles from prompt and inserts into generated table. Returns count.';
