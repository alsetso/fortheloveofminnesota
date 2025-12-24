-- Restore page_views and pin_views tables in analytics schema
-- Recreates the simplified views tracking system from migrations 223, 224, and 257
-- Tracks WHO views WHAT with account_id (user or guest)

-- ============================================================================
-- STEP 1: Create analytics schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- STEP 2: Create simplified page_views table
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Page identification (dynamic - any URL)
  page_url TEXT NOT NULL, -- Full URL path (e.g., '/explore/city/minneapolis', '/feed', '/account/settings')
  
  -- Viewer identification
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- NULL for anonymous visitors
  
  -- Metadata
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT, -- Optional: browser info
  referrer_url TEXT, -- Optional: where they came from
  session_id UUID, -- Optional: session tracking
  
  -- Constraints
  CONSTRAINT page_views_page_url_not_empty CHECK (LENGTH(TRIM(page_url)) > 0)
);

-- ============================================================================
-- STEP 3: Create pin_views table
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics.pin_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pin identification
  pin_id UUID NOT NULL REFERENCES public.pins(id) ON DELETE CASCADE,
  
  -- Viewer identification
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- NULL for anonymous visitors
  
  -- Metadata
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT, -- Optional: browser info
  referrer_url TEXT, -- Optional: where they came from
  session_id UUID, -- Optional: session tracking
  
  -- Constraints
  CONSTRAINT pin_views_pin_id_not_null CHECK (pin_id IS NOT NULL)
);

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

-- Page views indexes
CREATE INDEX IF NOT EXISTS idx_page_views_page_url ON analytics.page_views(page_url);
CREATE INDEX IF NOT EXISTS idx_page_views_account_id ON analytics.page_views(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON analytics.page_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_page_url_viewed_at ON analytics.page_views(page_url, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_account_page ON analytics.page_views(account_id, page_url, viewed_at DESC) WHERE account_id IS NOT NULL;

-- Pin views indexes
CREATE INDEX IF NOT EXISTS idx_pin_views_pin_id ON analytics.pin_views(pin_id);
CREATE INDEX IF NOT EXISTS idx_pin_views_account_id ON analytics.pin_views(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pin_views_viewed_at ON analytics.pin_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pin_views_pin_viewed_at ON analytics.pin_views(pin_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pin_views_account_pin ON analytics.pin_views(account_id, pin_id, viewed_at DESC) WHERE account_id IS NOT NULL;

-- Session ID indexes for anonymous tracking (from migration 257)
CREATE INDEX IF NOT EXISTS idx_page_views_session_id 
  ON analytics.page_views(session_id) 
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pin_views_session_id 
  ON analytics.pin_views(session_id) 
  WHERE session_id IS NOT NULL;

-- Composite indexes for anonymous viewer uniqueness queries
CREATE INDEX IF NOT EXISTS idx_page_views_session_page 
  ON analytics.page_views(session_id, page_url, viewed_at DESC) 
  WHERE account_id IS NULL AND session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pin_views_session_pin 
  ON analytics.pin_views(session_id, pin_id, viewed_at DESC) 
  WHERE account_id IS NULL AND session_id IS NOT NULL;

-- Partial index for authenticated-only queries (most common case)
CREATE INDEX IF NOT EXISTS idx_page_views_authenticated 
  ON analytics.page_views(account_id, page_url, viewed_at DESC) 
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pin_views_authenticated 
  ON analytics.pin_views(account_id, pin_id, viewed_at DESC) 
  WHERE account_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Create function to record page view
-- ============================================================================

-- Drop all existing overloads of record_page_view
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname = 'record_page_view' 
    AND pronamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public', 'analytics'))
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
      (SELECT nspname FROM pg_namespace WHERE oid = r.pronamespace), r.proname, r.args);
  END LOOP;
END $$;

CREATE FUNCTION analytics.record_page_view(
  p_page_url TEXT,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_view_id UUID;
BEGIN
  -- Validate page_url
  IF p_page_url IS NULL OR LENGTH(TRIM(p_page_url)) = 0 THEN
    RAISE EXCEPTION 'page_url cannot be empty';
  END IF;
  
  -- Insert page view record
  INSERT INTO analytics.page_views (
    page_url,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    TRIM(p_page_url),
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
-- STEP 5: Create function to record pin view
-- ============================================================================

-- Drop all existing overloads of record_pin_view
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname = 'record_pin_view' 
    AND pronamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public', 'analytics'))
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
      (SELECT nspname FROM pg_namespace WHERE oid = r.pronamespace), r.proname, r.args);
  END LOOP;
END $$;

CREATE FUNCTION analytics.record_pin_view(
  p_pin_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_view_id UUID;
BEGIN
  -- Validate pin_id
  IF p_pin_id IS NULL THEN
    RAISE EXCEPTION 'pin_id cannot be NULL';
  END IF;
  
  -- Verify pin exists
  IF NOT EXISTS (SELECT 1 FROM public.pins WHERE id = p_pin_id) THEN
    RAISE EXCEPTION 'Pin with id % does not exist', p_pin_id;
  END IF;
  
  -- Insert pin view record
  INSERT INTO analytics.pin_views (
    pin_id,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    p_pin_id,
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
-- STEP 6: Create helper functions for analytics (optimized from migration 257)
-- ============================================================================

-- Drop existing functions that might conflict
DROP FUNCTION IF EXISTS analytics.get_page_stats(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_page_stats(TEXT) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_pin_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_pin_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_page_viewers(TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_pin_viewers(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_page_stats(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_page_stats(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_pin_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_pin_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_page_viewers(TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_pin_viewers(UUID, INTEGER, INTEGER) CASCADE;

-- Get page view statistics (optimized)
CREATE FUNCTION analytics.get_page_stats(
  p_page_url TEXT,
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
    FROM analytics.page_views
    WHERE page_url = p_page_url
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

-- Get pin view statistics (optimized)
CREATE FUNCTION analytics.get_pin_stats(
  p_pin_id UUID,
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
    FROM analytics.pin_views
    WHERE pin_id = p_pin_id
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

-- Get recent viewers for a page
CREATE FUNCTION analytics.get_page_viewers(
  p_page_url TEXT,
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
  SELECT DISTINCT ON (pv.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(pv.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM analytics.page_views pv
  LEFT JOIN public.accounts a ON pv.account_id = a.id
  WHERE pv.page_url = p_page_url
    AND pv.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, pv.account_id
  ORDER BY pv.account_id, MAX(pv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get recent viewers for a pin
CREATE FUNCTION analytics.get_pin_viewers(
  p_pin_id UUID,
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
  SELECT DISTINCT ON (pv.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(pv.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM analytics.pin_views pv
  LEFT JOIN public.accounts a ON pv.account_id = a.id
  WHERE pv.pin_id = p_pin_id
    AND pv.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, pv.account_id
  ORDER BY pv.account_id, MAX(pv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE analytics.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.pin_views ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can record page views" ON analytics.page_views;
DROP POLICY IF EXISTS "Users can view own page views" ON analytics.page_views;
DROP POLICY IF EXISTS "Admins can view all page views" ON analytics.page_views;
DROP POLICY IF EXISTS "Anyone can record pin views" ON analytics.pin_views;
DROP POLICY IF EXISTS "Users can view own pin views" ON analytics.pin_views;
DROP POLICY IF EXISTS "Users can view views of own pins" ON analytics.pin_views;
DROP POLICY IF EXISTS "Admins can view all pin views" ON analytics.pin_views;

-- Page views policies
-- Anyone can insert page views (for tracking)
CREATE POLICY "Anyone can record page views"
  ON analytics.page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view their own page views (where they are the viewer)
CREATE POLICY "Users can view own page views"
  ON analytics.page_views FOR SELECT
  TO authenticated
  USING (
    account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
  );

-- Admins can view all page views (from migration 224)
CREATE POLICY "Admins can view all page views"
  ON analytics.page_views FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Pin views policies
-- Anyone can insert pin views (for tracking)
CREATE POLICY "Anyone can record pin views"
  ON analytics.pin_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view their own pin views (where they are the viewer)
CREATE POLICY "Users can view own pin views"
  ON analytics.pin_views FOR SELECT
  TO authenticated
  USING (
    account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
  );

-- Users can view pin views for pins they own
CREATE POLICY "Users can view views of own pins"
  ON analytics.pin_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pins
      WHERE pins.id = pin_views.pin_id
      AND pins.account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- Admins can view all pin views (from migration 224)
CREATE POLICY "Admins can view all pin views"
  ON analytics.pin_views FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

-- Table permissions
GRANT INSERT ON analytics.page_views TO anon, authenticated;
GRANT SELECT ON analytics.page_views TO authenticated;
GRANT INSERT ON analytics.pin_views TO anon, authenticated;
GRANT SELECT ON analytics.pin_views TO authenticated;

-- Function permissions
GRANT EXECUTE ON FUNCTION analytics.record_page_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics.record_pin_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_page_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_pin_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_page_viewers TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_pin_viewers TO authenticated;

-- ============================================================================
-- STEP 9: Add comments
-- ============================================================================

COMMENT ON TABLE analytics.page_views IS
  'Simplified page view tracking. Tracks WHO views WHAT URL dynamically. No entity types needed - any URL can be tracked.';

COMMENT ON TABLE analytics.pin_views IS
  'Pin view tracking. Tracks WHO views each pin.';

COMMENT ON COLUMN analytics.page_views.page_url IS
  'Full URL path being viewed (e.g., "/explore/city/minneapolis", "/feed", "/account/settings"). Dynamic - any URL can be tracked.';

COMMENT ON COLUMN analytics.page_views.account_id IS
  'Account ID of the viewer. NULL for anonymous visitors.';

COMMENT ON COLUMN analytics.pin_views.pin_id IS
  'ID of the pin being viewed.';

COMMENT ON COLUMN analytics.pin_views.account_id IS
  'Account ID of the viewer. NULL for anonymous visitors.';

COMMENT ON FUNCTION analytics.record_page_view IS
  'Records a page view for any URL. Returns the view ID.';

COMMENT ON FUNCTION analytics.record_pin_view IS
  'Records a pin view. Returns the view ID.';

COMMENT ON FUNCTION analytics.get_page_stats IS
  'Returns page statistics: total_views, unique_viewers (accounts + sessions), and accounts_viewed. p_hours filters to last N hours (NULL = all time).';

COMMENT ON FUNCTION analytics.get_pin_stats IS
  'Returns pin statistics: total_views, unique_viewers (accounts + sessions), and accounts_viewed. p_hours filters to last N hours (NULL = all time).';

COMMENT ON FUNCTION analytics.get_page_viewers IS
  'Returns list of accounts that viewed a page, with view counts.';

COMMENT ON FUNCTION analytics.get_pin_viewers IS
  'Returns list of accounts that viewed a pin, with view counts.';

COMMENT ON INDEX idx_page_views_session_id IS
  'Index for anonymous user tracking via session_id. Used when account_id IS NULL.';

COMMENT ON INDEX idx_pin_views_session_id IS
  'Index for anonymous user tracking via session_id. Used when account_id IS NULL.';

COMMENT ON INDEX idx_page_views_authenticated IS
  'Optimized index for authenticated user queries (most common case). Partial index excludes NULL account_id.';

COMMENT ON INDEX idx_pin_views_authenticated IS
  'Optimized index for authenticated user queries (most common case). Partial index excludes NULL account_id.';

COMMENT ON POLICY "Admins can view all page views" ON analytics.page_views IS
  'Allows users with admin role to view all page views for analytics and administration.';

COMMENT ON POLICY "Admins can view all pin views" ON analytics.pin_views IS
  'Allows users with admin role to view all pin views for analytics and administration.';


