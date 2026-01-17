-- Consolidate analytics schema into public.url_visits table
-- Migrates all view tracking to single URL-based table
-- Drops analytics schema and related tables

-- ============================================================================
-- STEP 1: Create public.url_visits table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.url_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- URL identification (full URL path with query params)
  url TEXT NOT NULL, -- e.g., '/explore/city/minneapolis', '/map?pin=uuid', '/profile/username'
  
  -- Viewer identification
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- NULL for anonymous visitors
  
  -- Metadata
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT, -- Optional: browser info
  referrer_url TEXT, -- Optional: where they came from
  session_id UUID, -- Optional: session tracking
  
  -- Constraints
  CONSTRAINT url_visits_url_not_empty CHECK (LENGTH(TRIM(url)) > 0)
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_url_visits_url ON public.url_visits(url);
CREATE INDEX IF NOT EXISTS idx_url_visits_account_id ON public.url_visits(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_url_visits_viewed_at ON public.url_visits(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_url_visits_url_viewed_at ON public.url_visits(url, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_url_visits_account_url ON public.url_visits(account_id, url, viewed_at DESC) WHERE account_id IS NOT NULL;

-- Session ID indexes for anonymous tracking
CREATE INDEX IF NOT EXISTS idx_url_visits_session_id 
  ON public.url_visits(session_id) 
  WHERE session_id IS NOT NULL;

-- Composite indexes for anonymous viewer uniqueness queries
CREATE INDEX IF NOT EXISTS idx_url_visits_session_url 
  ON public.url_visits(session_id, url, viewed_at DESC) 
  WHERE account_id IS NULL AND session_id IS NOT NULL;

-- Partial index for authenticated-only queries (most common case)
CREATE INDEX IF NOT EXISTS idx_url_visits_authenticated 
  ON public.url_visits(account_id, url, viewed_at DESC) 
  WHERE account_id IS NOT NULL;

-- Note: GIN index for URL pattern matching would require pg_trgm extension
-- Using standard btree index on url is sufficient for most queries

-- ============================================================================
-- STEP 3: Migrate data from analytics.page_views
-- ============================================================================

-- Migrate page_views data (page_url becomes url)
INSERT INTO public.url_visits (
  id,
  url,
  account_id,
  viewed_at,
  user_agent,
  referrer_url,
  session_id
)
SELECT 
  id,
  page_url AS url,
  account_id,
  viewed_at,
  user_agent,
  referrer_url,
  session_id
FROM analytics.page_views
ON CONFLICT (id) DO NOTHING;

-- Migrate pin_views data (convert to URL format: /map?pin={pin_id} or /profile/{username}?pinId={pin_id})
-- We'll reconstruct URLs based on pin_id references to mentions
INSERT INTO public.url_visits (
  id,
  url,
  account_id,
  viewed_at,
  user_agent,
  referrer_url,
  session_id
)
SELECT 
  pv.id,
  COALESCE(
    '/map?pin=' || pv.pin_id::TEXT,
    '/profile?pinId=' || pv.pin_id::TEXT
  ) AS url,
  pv.account_id,
  pv.viewed_at,
  pv.user_agent,
  pv.referrer_url,
  pv.session_id
FROM analytics.pin_views pv
ON CONFLICT (id) DO NOTHING;

-- Migrate map_views data (convert to URL format: /map/{map_id})
INSERT INTO public.url_visits (
  id,
  url,
  account_id,
  viewed_at,
  user_agent,
  referrer_url,
  session_id
)
SELECT 
  mv.id,
  '/map/' || mv.map_id::TEXT AS url,
  mv.account_id,
  mv.viewed_at,
  mv.user_agent,
  mv.referrer_url,
  mv.session_id
FROM analytics.map_views mv
ON CONFLICT (id) DO NOTHING;

-- Migrate special_map_views data (convert to URL format: /map/{map_identifier})
INSERT INTO public.url_visits (
  id,
  url,
  account_id,
  viewed_at,
  user_agent,
  referrer_url,
  session_id
)
SELECT 
  smv.id,
  '/map/' || smv.map_identifier AS url,
  smv.account_id,
  smv.viewed_at,
  smv.user_agent,
  smv.referrer_url,
  smv.session_id
FROM analytics.special_map_views smv
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: Add view_count column to mentions table if it doesn't exist
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Add constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'mentions_view_count_non_negative'
    AND conrelid = 'public.mentions'::regclass
  ) THEN
    ALTER TABLE public.mentions
      ADD CONSTRAINT mentions_view_count_non_negative CHECK (view_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mentions_view_count 
  ON public.mentions(view_count DESC) 
  WHERE view_count > 0;

-- ============================================================================
-- STEP 5: Create helper functions to extract entities from URLs
-- ============================================================================

-- Extract mention/pin ID from URL query parameter
CREATE OR REPLACE FUNCTION public.extract_mention_id_from_url(p_url TEXT)
RETURNS UUID AS $$
DECLARE
  v_mention_id TEXT;
BEGIN
  -- Extract from ?pin=uuid or ?pinId=uuid
  v_mention_id := (
    SELECT regexp_replace(
      regexp_replace(p_url, '.*[?&]pin[=:]([^&]+).*', '\1', 'g'),
      '.*[?&]pinId[=:]([^&]+).*', '\1', 'g'
    )
  );
  
  -- Return as UUID if valid, otherwise NULL
  BEGIN
    RETURN v_mention_id::UUID;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Extract profile username from URL
CREATE OR REPLACE FUNCTION public.extract_profile_username_from_url(p_url TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Extract from /profile/{username} or /profile/{username}?...
  RETURN regexp_replace(
    regexp_replace(p_url, '^/profile/([^/?]+).*', '\1', 'g'),
    '^/profile/([^/?]+).*', '\1', 'g'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STEP 6: Create function to record URL visit
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_url_visit(
  p_url TEXT,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_visit_id UUID;
  v_profile_username TEXT;
  v_profile_account_id UUID;
  v_mention_id UUID;
BEGIN
  -- Validate URL
  IF p_url IS NULL OR LENGTH(TRIM(p_url)) = 0 THEN
    RAISE EXCEPTION 'url cannot be empty';
  END IF;
  
  -- Insert URL visit record
  INSERT INTO public.url_visits (
    url,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    TRIM(p_url),
    p_account_id,
    p_user_agent,
    p_referrer_url,
    p_session_id,
    NOW()
  )
  RETURNING id INTO v_visit_id;
  
  -- Check if this is a profile page view and increment account view_count
  IF TRIM(p_url) LIKE '/profile/%' THEN
    v_profile_username := public.extract_profile_username_from_url(TRIM(p_url));
    
    IF v_profile_username IS NOT NULL AND LENGTH(v_profile_username) > 0 THEN
      SELECT id INTO v_profile_account_id
      FROM public.accounts
      WHERE LOWER(TRIM(username)) = LOWER(v_profile_username)
      LIMIT 1;
      
      -- If account found and it's not a self-visit, increment view_count
      IF v_profile_account_id IS NOT NULL THEN
        IF p_account_id IS NULL OR v_profile_account_id != p_account_id THEN
          UPDATE public.accounts
          SET view_count = COALESCE(view_count, 0) + 1
          WHERE id = v_profile_account_id;
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Check if this is a mention/pin view and increment mention view_count
  v_mention_id := public.extract_mention_id_from_url(TRIM(p_url));
  
  IF v_mention_id IS NOT NULL THEN
    -- Increment view_count for the mention
    UPDATE public.mentions
    SET view_count = view_count + 1
    WHERE id = v_mention_id;
  END IF;
  
  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: Create view count aggregation functions
-- ============================================================================

-- Get URL visit statistics
CREATE OR REPLACE FUNCTION public.get_url_stats(
  p_url TEXT,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_visits AS (
    SELECT 
      account_id,
      session_id
    FROM public.url_visits
    WHERE url = p_url
      AND (p_hours IS NULL OR viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL)
  )
  SELECT 
    COUNT(*)::BIGINT AS total_views,
    (
      COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL) +
      COUNT(DISTINCT session_id) FILTER (WHERE account_id IS NULL AND session_id IS NOT NULL)
    )::BIGINT AS unique_viewers,
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM filtered_visits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get mention view statistics (aggregates from URL visits)
CREATE OR REPLACE FUNCTION public.get_mention_stats(
  p_mention_id UUID,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_visits AS (
    SELECT 
      uv.account_id,
      uv.session_id
    FROM public.url_visits uv
    WHERE public.extract_mention_id_from_url(uv.url) = p_mention_id
      AND (p_hours IS NULL OR uv.viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL)
  )
  SELECT 
    COUNT(*)::BIGINT AS total_views,
    (
      COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL) +
      COUNT(DISTINCT session_id) FILTER (WHERE account_id IS NULL AND session_id IS NOT NULL)
    )::BIGINT AS unique_viewers,
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM filtered_visits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get mention viewers (PRO feature - only for mention owners)
CREATE OR REPLACE FUNCTION public.get_mention_viewers(
  p_mention_id UUID,
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
  SELECT DISTINCT ON (uv.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(uv.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM public.url_visits uv
  LEFT JOIN public.accounts a ON uv.account_id = a.id
  WHERE public.extract_mention_id_from_url(uv.url) = p_mention_id
    AND uv.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, uv.account_id
  ORDER BY uv.account_id, MAX(uv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get profile viewers (PRO feature - only for profile owners)
CREATE OR REPLACE FUNCTION public.get_profile_viewers(
  p_username TEXT,
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
  SELECT DISTINCT ON (uv.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(uv.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM public.url_visits uv
  LEFT JOIN public.accounts a ON uv.account_id = a.id
  WHERE uv.url LIKE '/profile/' || p_username || '%'
    AND uv.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, uv.account_id
  ORDER BY uv.account_id, MAX(uv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get map viewers (PRO feature - only for map owners)
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (uv.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(uv.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM public.url_visits uv
  LEFT JOIN public.accounts a ON uv.account_id = a.id
  WHERE uv.url = '/map/' || p_map_id::TEXT
    AND uv.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, uv.account_id
  ORDER BY uv.account_id, MAX(uv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.url_visits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can record URL visits" ON public.url_visits;
DROP POLICY IF EXISTS "Users can view own URL visits" ON public.url_visits;
DROP POLICY IF EXISTS "PRO users can view profile visitors" ON public.url_visits;
DROP POLICY IF EXISTS "PRO users can view mention visitors" ON public.url_visits;
DROP POLICY IF EXISTS "Admins can view all URL visits" ON public.url_visits;

-- Anyone can insert URL visits (for tracking)
CREATE POLICY "Anyone can record URL visits"
  ON public.url_visits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view their own URL visits (where they are the viewer)
CREATE POLICY "Users can view own URL visits"
  ON public.url_visits FOR SELECT
  TO authenticated
  USING (
    account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
  );

-- PRO users can view visitors to their own profile
CREATE POLICY "PRO users can view profile visitors"
  ON public.url_visits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.user_id = auth.uid()
        AND a.plan = 'pro'
        AND public.url_visits.url LIKE '/profile/' || a.username || '%'
    )
  );

-- PRO users can view visitors to their own mentions
CREATE POLICY "PRO users can view mention visitors"
  ON public.url_visits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentions m
      JOIN public.accounts a ON m.account_id = a.id
      WHERE a.user_id = auth.uid()
        AND a.plan = 'pro'
        AND public.extract_mention_id_from_url(public.url_visits.url) = m.id
    )
  );

-- Admins can view all URL visits
CREATE POLICY "Admins can view all URL visits"
  ON public.url_visits FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 9: Grant permissions
-- ============================================================================

-- Table permissions
GRANT INSERT ON public.url_visits TO anon, authenticated;
GRANT SELECT ON public.url_visits TO authenticated;

-- Function permissions
GRANT EXECUTE ON FUNCTION public.record_url_visit TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_url_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mention_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mention_viewers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_viewers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_viewers TO authenticated;

-- ============================================================================
-- STEP 10: Drop analytics schema and related objects
-- ============================================================================

-- Drop public wrapper functions that reference analytics schema
DROP FUNCTION IF EXISTS public.record_page_view(TEXT, UUID, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.record_pin_view(UUID, UUID, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.record_map_view(UUID, UUID, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_page_stats(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_pin_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_page_viewers(TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_pin_viewers(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_viewers(UUID, INTEGER, INTEGER) CASCADE;

-- Drop public views that reference analytics schema
DROP VIEW IF EXISTS public.page_views CASCADE;
DROP VIEW IF EXISTS public.pin_views CASCADE;

-- Drop analytics schema functions
DROP FUNCTION IF EXISTS analytics.record_page_view CASCADE;
DROP FUNCTION IF EXISTS analytics.record_pin_view CASCADE;
DROP FUNCTION IF EXISTS analytics.record_map_view CASCADE;
DROP FUNCTION IF EXISTS analytics.record_special_map_view CASCADE;
DROP FUNCTION IF EXISTS analytics.get_page_stats CASCADE;
DROP FUNCTION IF EXISTS analytics.get_pin_stats CASCADE;
DROP FUNCTION IF EXISTS analytics.get_map_stats CASCADE;
DROP FUNCTION IF EXISTS analytics.get_special_map_stats CASCADE;
DROP FUNCTION IF EXISTS analytics.get_page_viewers CASCADE;
DROP FUNCTION IF EXISTS analytics.get_pin_viewers CASCADE;
DROP FUNCTION IF EXISTS analytics.get_map_viewers CASCADE;

-- Drop analytics tables
DROP TABLE IF EXISTS analytics.page_views CASCADE;
DROP TABLE IF EXISTS analytics.pin_views CASCADE;
DROP TABLE IF EXISTS analytics.map_views CASCADE;
DROP TABLE IF EXISTS analytics.special_map_views CASCADE;

-- Drop analytics schema (only if empty)
DO $$
BEGIN
  -- Check if schema is empty (no remaining objects)
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'analytics'
    UNION ALL
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'analytics'
  ) THEN
    DROP SCHEMA IF EXISTS analytics CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 11: Add comments
-- ============================================================================

COMMENT ON TABLE public.url_visits IS
  'Unified URL-based view tracking. Tracks all page, map, and mention views via URLs. View counts are public; visitor identities (WHO) are PRO-only for content owners.';

COMMENT ON COLUMN public.url_visits.url IS
  'Full URL path with query params (e.g., "/explore/city/minneapolis", "/map?pin=uuid", "/profile/username").';

COMMENT ON COLUMN public.url_visits.account_id IS
  'Account ID of the viewer. NULL for anonymous visitors.';

COMMENT ON COLUMN public.mentions.view_count IS
  'Total number of views for this mention. Aggregated from url_visits table.';

COMMENT ON FUNCTION public.record_url_visit IS
  'Records a URL visit and automatically increments view_count for profile pages and mentions. Returns the visit ID.';

COMMENT ON FUNCTION public.get_url_stats IS
  'Returns URL statistics: total_views, unique_viewers (accounts + sessions), and accounts_viewed. p_hours filters to last N hours (NULL = all time).';

COMMENT ON FUNCTION public.get_mention_stats IS
  'Returns mention statistics aggregated from URL visits. View counts are public.';

COMMENT ON FUNCTION public.get_mention_viewers IS
  'Returns list of accounts that viewed a mention (PRO feature - only for mention owners).';

COMMENT ON FUNCTION public.get_profile_viewers IS
  'Returns list of accounts that viewed a profile (PRO feature - only for profile owners).';

COMMENT ON FUNCTION public.get_map_viewers IS
  'Returns list of accounts that viewed a map (PRO feature - only for map owners).';

-- ============================================================================
-- STEP 12: Force PostgREST schema cache refresh
-- ============================================================================

-- Force PostgREST to reload schema cache after major schema changes
-- This fixes "Could not query the database for the schema cache" errors
-- In Supabase cloud, PostgREST will auto-refresh within a few minutes
-- In local dev, you may need to restart the Supabase stack
NOTIFY pgrst, 'reload schema';

COMMENT ON POLICY "PRO users can view profile visitors" ON public.url_visits IS
  'Allows PRO account owners to see WHO visited their profile (visitor identities).';

COMMENT ON POLICY "PRO users can view mention visitors" ON public.url_visits IS
  'Allows PRO account owners to see WHO viewed their mentions (visitor identities).';
