-- Create map_views table in analytics schema
-- Tracks WHO views WHAT map

-- ============================================================================
-- STEP 1: Create map_views table
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics.map_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Map identification
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  
  -- Viewer identification
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- NULL for anonymous visitors
  
  -- Metadata
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT, -- Optional: browser info
  referrer_url TEXT, -- Optional: where they came from
  session_id UUID, -- Optional: session tracking
  
  -- Constraints
  CONSTRAINT map_views_map_id_not_null CHECK (map_id IS NOT NULL)
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_map_views_map_id ON analytics.map_views(map_id);
CREATE INDEX IF NOT EXISTS idx_map_views_account_id ON analytics.map_views(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_map_views_viewed_at ON analytics.map_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_views_map_viewed_at ON analytics.map_views(map_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_views_account_map ON analytics.map_views(account_id, map_id, viewed_at DESC) WHERE account_id IS NOT NULL;

-- Session ID indexes for anonymous tracking
CREATE INDEX IF NOT EXISTS idx_map_views_session_id 
  ON analytics.map_views(session_id) 
  WHERE session_id IS NOT NULL;

-- Composite indexes for anonymous viewer uniqueness queries
CREATE INDEX IF NOT EXISTS idx_map_views_session_map 
  ON analytics.map_views(session_id, map_id, viewed_at DESC) 
  WHERE account_id IS NULL AND session_id IS NOT NULL;

-- Partial index for authenticated-only queries (most common case)
CREATE INDEX IF NOT EXISTS idx_map_views_authenticated 
  ON analytics.map_views(account_id, map_id, viewed_at DESC) 
  WHERE account_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Create function to record map view
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS analytics.record_map_view(UUID, UUID, TEXT, TEXT, UUID) CASCADE;

CREATE FUNCTION analytics.record_map_view(
  p_map_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_view_id UUID;
BEGIN
  -- Validate map_id
  IF p_map_id IS NULL THEN
    RAISE EXCEPTION 'map_id cannot be NULL';
  END IF;
  
  -- Verify map exists
  IF NOT EXISTS (SELECT 1 FROM public.map WHERE id = p_map_id) THEN
    RAISE EXCEPTION 'Map with id % does not exist', p_map_id;
  END IF;
  
  -- Insert map view record
  INSERT INTO analytics.map_views (
    map_id,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    p_map_id,
    p_account_id,
    p_user_agent,
    p_referrer_url,
    p_session_id,
    NOW()
  )
  RETURNING id INTO v_view_id;
  
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Create helper functions for analytics
-- ============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS analytics.get_map_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_map_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_map_viewers(UUID, INTEGER, INTEGER) CASCADE;

-- Get map view statistics (optimized)
CREATE FUNCTION analytics.get_map_stats(
  p_map_id UUID,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_views AS (
    SELECT 
      account_id,
      session_id
    FROM analytics.map_views
    WHERE map_id = p_map_id
      AND (p_hours IS NULL OR viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL)
  )
  SELECT 
    COUNT(*)::BIGINT AS total_views,
    (
      COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL) +
      COUNT(DISTINCT session_id) FILTER (WHERE account_id IS NULL AND session_id IS NOT NULL)
    )::BIGINT AS unique_viewers,
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM filtered_views;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get recent viewers for a map
CREATE FUNCTION analytics.get_map_viewers(
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (mv.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(mv.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM analytics.map_views mv
  LEFT JOIN public.accounts a ON mv.account_id = a.id
  WHERE mv.map_id = p_map_id
    AND mv.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, mv.account_id
  ORDER BY mv.account_id, MAX(mv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE analytics.map_views ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can record map views" ON analytics.map_views;
DROP POLICY IF EXISTS "Users can view own map views" ON analytics.map_views;
DROP POLICY IF EXISTS "Users can view views of own maps" ON analytics.map_views;
DROP POLICY IF EXISTS "Admins can view all map views" ON analytics.map_views;

-- Map views policies
-- Anyone can insert map views (for tracking)
CREATE POLICY "Anyone can record map views"
  ON analytics.map_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view their own map views (where they are the viewer)
CREATE POLICY "Users can view own map views"
  ON analytics.map_views FOR SELECT
  TO authenticated
  USING (
    account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
  );

-- Users can view map views for maps they own
CREATE POLICY "Users can view views of own maps"
  ON analytics.map_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_views.map_id
      AND map.account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- Admins can view all map views
CREATE POLICY "Admins can view all map views"
  ON analytics.map_views FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

-- Table permissions
GRANT INSERT ON analytics.map_views TO anon, authenticated;
GRANT SELECT ON analytics.map_views TO authenticated;

-- Function permissions
GRANT EXECUTE ON FUNCTION analytics.record_map_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_map_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_map_viewers TO authenticated;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE analytics.map_views IS
  'Map view tracking. Tracks WHO views each map.';

COMMENT ON COLUMN analytics.map_views.map_id IS
  'ID of the map being viewed.';

COMMENT ON COLUMN analytics.map_views.account_id IS
  'Account ID of the viewer. NULL for anonymous visitors.';

COMMENT ON FUNCTION analytics.record_map_view IS
  'Records a map view. Returns the view ID.';

COMMENT ON FUNCTION analytics.get_map_stats IS
  'Returns map statistics: total_views, unique_viewers (accounts + sessions), and accounts_viewed. p_hours filters to last N hours (NULL = all time).';

COMMENT ON FUNCTION analytics.get_map_viewers IS
  'Returns list of accounts that viewed a map, with view counts.';

COMMENT ON INDEX idx_map_views_session_id IS
  'Index for anonymous user tracking via session_id. Used when account_id IS NULL.';

COMMENT ON INDEX idx_map_views_authenticated IS
  'Optimized index for authenticated user queries (most common case). Partial index excludes NULL account_id.';

COMMENT ON POLICY "Admins can view all map views" ON analytics.map_views IS
  'Allows users with admin role to view all map views for analytics and administration.';

-- ============================================================================
-- STEP 8: Create public wrapper function for get_map_stats
-- ============================================================================

-- Drop existing wrapper if it exists
DROP FUNCTION IF EXISTS public.get_map_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_stats(UUID) CASCADE;

CREATE FUNCTION public.get_map_stats(
  p_map_id UUID,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_map_stats(p_map_id, p_hours);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_map_stats TO anon, authenticated;

COMMENT ON FUNCTION public.get_map_stats IS
  'Public wrapper for analytics.get_map_stats. Returns map statistics: total_views, unique_viewers (accounts + sessions), and accounts_viewed. p_hours filters to last N hours (NULL = all time).';

