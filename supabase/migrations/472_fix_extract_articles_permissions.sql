-- Ensure extract_articles_from_prompt has proper permissions and can bypass RLS
-- The function needs to insert into news.generated even if the caller isn't an admin

-- Ensure the function owner can insert (SECURITY DEFINER functions run as the owner)
ALTER FUNCTION news.extract_articles_from_prompt OWNER TO postgres;
ALTER FUNCTION public.extract_articles_from_prompt OWNER TO postgres;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.extract_articles_from_prompt TO authenticated;

-- Ensure PostgREST can see the function (it should be in public schema)
-- The function is already in public schema, so PostgREST should be able to call it

-- Verify the function exists and is callable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'extract_articles_from_prompt'
  ) THEN
    RAISE EXCEPTION 'Function public.extract_articles_from_prompt does not exist';
  END IF;
END $$;
