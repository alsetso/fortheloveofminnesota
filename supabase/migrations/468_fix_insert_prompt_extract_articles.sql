-- Fix insert_prompt to manually extract articles after insert
-- The trigger may not fire reliably when called via RPC, so we call extraction explicitly

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
  v_extract_count INTEGER;
  v_articles JSONB;
  v_articles_count INTEGER;
BEGIN
  INSERT INTO news.prompt (account_id, user_input, api_response)
  VALUES (p_account_id, p_user_input, p_api_response)
  RETURNING news.prompt.id INTO v_prompt_id;
  
  -- Check if articles exist in api_response
  v_articles := p_api_response->'articles';
  IF v_articles IS NOT NULL THEN
    v_articles_count := jsonb_array_length(v_articles);
  ELSE
    v_articles_count := 0;
  END IF;
  
  -- Manually trigger article extraction
  -- (Trigger should fire automatically, but we call it explicitly to ensure it happens)
  BEGIN
    SELECT news.extract_articles_from_prompt(v_prompt_id) INTO v_extract_count;
    
    -- If extraction returned 0 but we have articles, raise a warning
    IF v_extract_count = 0 AND v_articles_count > 0 THEN
      RAISE WARNING 'Extraction returned 0 articles but api_response contains % articles', v_articles_count;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error during article extraction: %', SQLERRM;
      -- Continue anyway, return the prompt
  END;
  
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
  'Inserts a new prompt into news.prompt and extracts articles to news.generated.';
