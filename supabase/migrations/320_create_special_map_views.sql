-- Create special_map_views table for tracking views of hardcoded community maps
-- (e.g., /map/mention, /map/fraud) that don't have database entries

-- ============================================================================
-- STEP 1: Create special_map_views table
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics.special_map_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Map identifier (e.g., 'mention', 'fraud')
  map_identifier TEXT NOT NULL,
  
  -- Viewer identification
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- NULL for anonymous visitors
  
  -- Metadata
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT, -- Optional: browser info
  referrer_url TEXT, -- Optional: where they came from
  session_id UUID, -- Optional: session tracking
  
  -- Constraints
  CONSTRAINT special_map_views_identifier_not_null CHECK (map_identifier IS NOT NULL),
  CONSTRAINT special_map_views_identifier_length CHECK (char_length(map_identifier) > 0)
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_special_map_views_identifier ON analytics.special_map_views(map_identifier);
CREATE INDEX IF NOT EXISTS idx_special_map_views_account_id ON analytics.special_map_views(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_special_map_views_viewed_at ON analytics.special_map_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_map_views_identifier_viewed_at ON analytics.special_map_views(map_identifier, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_map_views_session_id ON analytics.special_map_views(session_id) WHERE session_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Create function to record special map view
-- ============================================================================

CREATE OR REPLACE FUNCTION analytics.record_special_map_view(
  p_map_identifier TEXT,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_view_id UUID;
BEGIN
  -- Validate map_identifier
  IF p_map_identifier IS NULL OR char_length(p_map_identifier) = 0 THEN
    RAISE EXCEPTION 'map_identifier cannot be NULL or empty';
  END IF;
  
  -- Insert special map view record
  INSERT INTO analytics.special_map_views (
    map_identifier,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    p_map_identifier,
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
-- STEP 4: Create function to get special map stats
-- ============================================================================

CREATE OR REPLACE FUNCTION analytics.get_special_map_stats(
  p_map_identifier TEXT,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_views,
    COUNT(DISTINCT COALESCE(account_id::TEXT, session_id::TEXT))::BIGINT AS unique_viewers,
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM analytics.special_map_views
  WHERE map_identifier = p_map_identifier
    AND (p_hours IS NULL OR viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE analytics.special_map_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert special map views (for tracking)
CREATE POLICY "Anyone can record special map views"
  ON analytics.special_map_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can view special map stats (aggregated data)
CREATE POLICY "Anyone can view special map stats"
  ON analytics.special_map_views FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- STEP 6: Grant Permissions
-- ============================================================================

-- Grant table permissions
GRANT INSERT ON analytics.special_map_views TO anon, authenticated;
GRANT SELECT ON analytics.special_map_views TO anon, authenticated;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION analytics.record_special_map_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_special_map_stats TO anon, authenticated;

-- ============================================================================
-- STEP 7: Comments
-- ============================================================================

COMMENT ON TABLE analytics.special_map_views IS 'Tracks views of special hardcoded maps (e.g., /map/mention, /map/fraud)';
COMMENT ON COLUMN analytics.special_map_views.map_identifier IS 'Identifier for the special map (e.g., "mention", "fraud")';
COMMENT ON FUNCTION analytics.record_special_map_view IS 'Records a view for a special map';
COMMENT ON FUNCTION analytics.get_special_map_stats IS 'Returns statistics for a special map';

