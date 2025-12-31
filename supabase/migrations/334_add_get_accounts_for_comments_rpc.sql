-- Create RPC function to get accounts for comments (bypasses RLS)
-- This allows the service client to fetch account data without RLS issues

CREATE OR REPLACE FUNCTION public.get_accounts_for_comments(p_account_ids UUID[])
RETURNS TABLE (
  id UUID,
  username TEXT,
  first_name TEXT,
  image_url TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.username,
    a.first_name,
    a.image_url
  FROM public.accounts a
  WHERE a.id = ANY(p_account_ids);
END;
$$;

COMMENT ON FUNCTION public.get_accounts_for_comments IS 'Returns account data for given account IDs. Uses SECURITY DEFINER to bypass RLS.';

GRANT EXECUTE ON FUNCTION public.get_accounts_for_comments TO authenticated, anon, service_role;

