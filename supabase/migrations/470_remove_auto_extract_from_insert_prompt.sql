-- Remove automatic extraction from insert_prompt
-- Articles will be extracted manually after preview via the save endpoint

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
  
  -- Do NOT extract articles automatically - wait for save endpoint
  
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
  'Inserts a new prompt into news.prompt. Articles are extracted separately via extract_articles_from_prompt.';
