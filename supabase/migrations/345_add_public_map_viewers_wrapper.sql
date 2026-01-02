-- Add public wrapper function for analytics.get_map_viewers
-- This allows the Supabase client to call the function via RPC

-- ============================================================================
-- STEP 1: Create public view for map_views (similar to page_views and pin_views)
-- ============================================================================

CREATE OR REPLACE VIEW public.map_views AS
SELECT * FROM analytics.map_views;

GRANT SELECT, INSERT ON public.map_views TO authenticated;

-- Create INSTEAD OF trigger for INSERT operations
DROP TRIGGER IF EXISTS map_views_instead_of_insert ON public.map_views;

CREATE OR REPLACE FUNCTION public.map_views_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO analytics.map_views (
    map_id,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    NEW.map_id,
    NEW.account_id,
    NEW.user_agent,
    NEW.referrer_url,
    NEW.session_id,
    COALESCE(NEW.viewed_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER map_views_instead_of_insert
  INSTEAD OF INSERT ON public.map_views
  FOR EACH ROW
  EXECUTE FUNCTION public.map_views_insert_trigger();

-- ============================================================================
-- STEP 2: Create public wrapper function
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_map_viewers(UUID, INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.get_map_viewers(
  p_map_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  account_id UUID,
  account_username TEXT,
  account_first_name TEXT,
  account_last_name TEXT,
  account_image_url TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE,
  view_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_map_viewers(p_map_id, p_limit, p_offset);
END;
$$;

-- ============================================================================
-- STEP 3: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_map_viewers TO authenticated;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON VIEW public.map_views IS
  'Public view of analytics.map_views. Allows Supabase client to access analytics schema tables via public schema.';

COMMENT ON FUNCTION public.get_map_viewers IS
  'Public wrapper for analytics.get_map_viewers. Returns list of accounts that viewed a map.';

