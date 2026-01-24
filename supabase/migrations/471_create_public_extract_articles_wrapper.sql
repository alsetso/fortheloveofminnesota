-- Create public wrapper function for extract_articles_from_prompt
-- This allows calling it via RPC from the API

CREATE OR REPLACE FUNCTION public.extract_articles_from_prompt(
  p_prompt_id UUID
) RETURNS INTEGER AS $$
BEGIN
  RETURN news.extract_articles_from_prompt(p_prompt_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.extract_articles_from_prompt IS 
  'Public wrapper for news.extract_articles_from_prompt. Extracts articles from prompt and inserts into generated table.';

GRANT EXECUTE ON FUNCTION public.extract_articles_from_prompt TO authenticated;
