-- Add RPC function to get recent account activity for admin dashboard
-- Returns unique accounts active in the last N hours with their activities

CREATE OR REPLACE FUNCTION public.get_recent_account_activity(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  account_id UUID,
  account_username TEXT,
  account_first_name TEXT,
  account_last_name TEXT,
  account_image_url TEXT,
  entity_type TEXT,
  entity_id UUID,
  url TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    e.entity_type,
    e.entity_id,
    e.url,
    e.viewed_at
  FROM analytics.events e
  INNER JOIN public.accounts a ON e.account_id = a.id
  WHERE e.account_id IS NOT NULL
    AND e.viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY e.viewed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admin check happens in API route)
GRANT EXECUTE ON FUNCTION public.get_recent_account_activity TO authenticated;

COMMENT ON FUNCTION public.get_recent_account_activity IS
  'Returns recent account activity for admin dashboard. Shows unique accounts active in the last N hours with their activities from analytics.events.';
