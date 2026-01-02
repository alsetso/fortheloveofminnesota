-- Auto-generate news every 24 hours using pg_cron
-- Migration 294: Scheduled news generation job

-- ============================================================================
-- STEP 1: Function to directly generate news (recommended approach)
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
  v_result JSONB;
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

-- ============================================================================
-- STEP 2: Schedule with pg_cron (if extension is available)
-- ============================================================================

-- Schedule news generation to run every 24 hours at 6 AM Central Time (noon UTC)
-- Adjust the cron schedule as needed
DO $cron_setup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    BEGIN
      PERFORM cron.unschedule('auto-generate-news');
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- Job doesn't exist, which is fine
    END;
    
    -- Schedule new job to run every 24 hours at 6 AM Central Time (noon UTC)
    -- Cron format: minute hour day month weekday
    -- '0 12 * * *' = Every day at 12:00 UTC (6 AM Central in winter, 7 AM in summer)
    PERFORM cron.schedule(
      'auto-generate-news',
      '0 12 * * *', -- Daily at noon UTC (6 AM Central)
      $$SELECT public.auto_generate_news()$$
    );
    
    RAISE NOTICE 'Scheduled auto-generate-news job to run daily at 6 AM Central Time';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Job must be scheduled externally or via Supabase dashboard.';
    RAISE NOTICE 'To enable pg_cron, go to Supabase Dashboard > Database > Extensions and enable pg_cron.';
  END IF;
END $cron_setup$;

-- ============================================================================
-- STEP 3: Grant permissions
-- ============================================================================

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.auto_generate_news() TO service_role;

-- ============================================================================
-- STEP 4: Configuration instructions
-- ============================================================================

-- To configure this job, you need to:
-- 1. Enable pg_cron extension in Supabase Dashboard (Database > Extensions)
-- 2. Enable http extension in Supabase Dashboard (Database > Extensions)
-- 3. Set the RapidAPI key as a database setting (use Supabase Dashboard > Settings > Database):
--    - Go to Database Settings
--    - Add custom config: app.rapidapi_key = 'your-rapidapi-key-here'
--    - Or use: ALTER DATABASE postgres SET app.rapidapi_key = 'your-api-key';
-- 4. Ensure at least one admin account exists in the accounts table
-- 5. Optionally adjust the cron schedule in the DO block above

-- To manually test the function:
-- SELECT public.auto_generate_news();

-- To check scheduled jobs:
-- SELECT * FROM cron.job WHERE jobname = 'auto-generate-news';

-- To unschedule the job:
-- SELECT cron.unschedule('auto-generate-news');

