-- Update auto_generate_news function to use news.prompt instead of public.news_gen
-- Migration 340: Fix function to work with new news schema (prompt/generated)

-- ============================================================================
-- Update auto_generate_news function
-- ============================================================================

-- This function directly calls RapidAPI and saves to news.prompt table
-- Trigger automatically extracts articles to news.generated
-- Requires: http extension enabled, RapidAPI key configured, at least one admin account
CREATE OR REPLACE FUNCTION public.auto_generate_news()
RETURNS JSONB AS $$
DECLARE
  v_account_id UUID;
  v_api_key TEXT;
  v_url TEXT;
  v_response JSONB;
  v_articles JSONB;
  v_prompt_id UUID;
BEGIN
  -- Get a system account ID (you may need to create a system account)
  -- For now, we'll use the first admin account
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE role = 'admin'
  LIMIT 1;
  
  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No admin account found for news generation'
    );
  END IF;
  
  -- Get API key from environment
  v_api_key := COALESCE(
    current_setting('app.rapidapi_key', true),
    ''
  );
  
  IF v_api_key = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'RapidAPI key not configured'
    );
  END IF;
  
  -- Build API URL
  v_url := 'https://real-time-news-data.p.rapidapi.com/search?' ||
    'query=Minnesota, MN&' ||
    'time_published=1d&' ||
    'country=US&' ||
    'lang=en';
  
  -- Make API call using http extension
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
    
    -- Parse response and save to news.prompt (trigger auto-extracts to news.generated)
    IF v_response->>'status' = 'OK' THEN
      v_articles := v_response->'data';
      
      -- Save to database using news.prompt (trigger will extract articles to news.generated)
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
      RETURNING id INTO v_prompt_id;
      
      RETURN jsonb_build_object('id', v_prompt_id, 'success', true);
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
  'Directly generates news by calling RapidAPI and saving to news.prompt. Trigger automatically extracts articles to news.generated. Runs automatically every 24 hours.';

