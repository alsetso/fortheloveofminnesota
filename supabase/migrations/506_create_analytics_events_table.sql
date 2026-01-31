-- Create analytics.events table for structured relationship tracking
-- Complements url_visits with direct entity relationships for better analytics

-- ============================================================================
-- STEP 1: Create analytics schema if it doesn't exist
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- STEP 2: Create analytics.events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Viewer identification
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- NULL for anonymous visitors
  session_id UUID, -- Device ID for anonymous tracking
  
  -- Entity relationship (the core improvement)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('map', 'pin', 'profile', 'post', 'page', 'other')),
  entity_id UUID, -- NULL for 'page' or 'other' types without specific entity
  
  -- Reference to original URL visit
  url TEXT NOT NULL, -- Original URL for reference
  url_visit_id UUID REFERENCES public.url_visits(id) ON DELETE SET NULL, -- Link back to url_visits if needed
  
  -- Metadata
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  referrer_url TEXT,
  
  -- Flexible metadata storage
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT events_entity_id_check CHECK (
    (entity_type IN ('map', 'pin', 'profile', 'post') AND entity_id IS NOT NULL) OR
    (entity_type IN ('page', 'other') AND entity_id IS NULL)
  )
);

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

-- Entity relationship indexes (the key benefit)
CREATE INDEX IF NOT EXISTS idx_events_entity_type_id ON analytics.events(entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_account_entity ON analytics.events(account_id, entity_type, entity_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_viewed_at ON analytics.events(viewed_at DESC);

-- Account-based queries
CREATE INDEX IF NOT EXISTS idx_events_account_id ON analytics.events(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_account_viewed_at ON analytics.events(account_id, viewed_at DESC) WHERE account_id IS NOT NULL;

-- Session-based queries (anonymous tracking)
CREATE INDEX IF NOT EXISTS idx_events_session_id ON analytics.events(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_session_entity ON analytics.events(session_id, entity_type, entity_id) WHERE session_id IS NOT NULL AND entity_id IS NOT NULL;

-- URL reference index
CREATE INDEX IF NOT EXISTS idx_events_url_visit_id ON analytics.events(url_visit_id) WHERE url_visit_id IS NOT NULL;

-- Composite index for common queries: "all events for this entity"
CREATE INDEX IF NOT EXISTS idx_events_entity_composite ON analytics.events(entity_type, entity_id, viewed_at DESC) WHERE entity_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Create helper functions to extract entity relationships from URLs
-- ============================================================================

-- Extract map ID or slug from URL
CREATE OR REPLACE FUNCTION analytics.extract_map_entity_from_url(p_url TEXT)
RETURNS TABLE (
  entity_id UUID,
  is_slug BOOLEAN,
  slug TEXT
) AS $$
DECLARE
  v_uuid_match TEXT;
  v_slug_match TEXT;
  v_map_id UUID;
BEGIN
  -- Try UUID format: /map/{uuid}
  v_uuid_match := (SELECT regexp_replace(p_url, '^/map/([a-f0-9-]{36})(?:[/?]|$).*', '\1', 'i'));
  
  IF v_uuid_match != p_url AND v_uuid_match ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    BEGIN
      v_map_id := v_uuid_match::UUID;
      RETURN QUERY SELECT v_map_id, false::BOOLEAN, NULL::TEXT;
      RETURN;
    EXCEPTION
      WHEN OTHERS THEN
        -- Invalid UUID, continue to slug check
    END;
  END IF;
  
  -- Try slug format: /map/{slug}
  v_slug_match := (SELECT regexp_replace(p_url, '^/map/([a-z0-9-]+)(?:[/?]|$).*', '\1', 'i'));
  
  IF v_slug_match != p_url AND v_slug_match != '' THEN
    -- Look up map by slug (qualify column reference to avoid ambiguity)
    SELECT m.id INTO v_map_id
    FROM public.map m
    WHERE m.slug = v_slug_match
      AND m.is_active = true
    LIMIT 1;
    
    IF v_map_id IS NOT NULL THEN
      RETURN QUERY SELECT v_map_id, true::BOOLEAN, v_slug_match::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- No match found
  RETURN QUERY SELECT NULL::UUID, false::BOOLEAN, NULL::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- Extract post ID from URL
CREATE OR REPLACE FUNCTION analytics.extract_post_id_from_url(p_url TEXT)
RETURNS UUID AS $$
DECLARE
  v_post_id TEXT;
BEGIN
  -- Extract from /post/{uuid}
  v_post_id := (SELECT regexp_replace(p_url, '^/post/([a-f0-9-]{36})(?:[/?]|$).*', '\1', 'i'));
  
  IF v_post_id != p_url AND v_post_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    BEGIN
      RETURN v_post_id::UUID;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN NULL;
    END;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Extract profile account ID from URL
CREATE OR REPLACE FUNCTION analytics.extract_profile_account_id_from_url(p_url TEXT)
RETURNS UUID AS $$
DECLARE
  v_username TEXT;
  v_account_id UUID;
BEGIN
  -- Try /profile/{username} format
  v_username := public.extract_profile_username_from_url(p_url);
  
  IF v_username IS NULL OR v_username = '' THEN
    -- Try /{username} format (single segment path)
    v_username := (SELECT regexp_replace(p_url, '^/([^/?]+)(?:[/?]|$).*', '\1', 'i'));
    
    -- Exclude known non-profile paths
    IF v_username IN ('feed', 'maps', 'live', 'explore', 'settings', 'analytics', 'gov', 'contact', 'onboarding', 'billing', 'admin') THEN
      RETURN NULL;
    END IF;
  END IF;
  
  IF v_username IS NOT NULL AND v_username != '' THEN
    SELECT id INTO v_account_id
    FROM public.accounts
    WHERE LOWER(TRIM(username)) = LOWER(v_username)
    LIMIT 1;
    
    RETURN v_account_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Main function: Extract entity type and ID from URL
CREATE OR REPLACE FUNCTION analytics.extract_entity_from_url(p_url TEXT)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID
) AS $$
DECLARE
  v_mention_id UUID;
  v_post_id UUID;
  v_map_id UUID;
  v_profile_account_id UUID;
BEGIN
  -- Check for pin/mention: ?pin={id} or ?pinId={id} or /mention/{id}
  v_mention_id := public.extract_mention_id_from_url(p_url);
  
  IF v_mention_id IS NOT NULL THEN
    -- Verify it exists in map_pins
    IF EXISTS (SELECT 1 FROM public.map_pins WHERE id = v_mention_id AND is_active = true) THEN
      RETURN QUERY SELECT 'pin'::TEXT, v_mention_id;
      RETURN;
    END IF;
  END IF;
  
  -- Check for /mention/{id}
  IF p_url LIKE '/mention/%' THEN
    BEGIN
      v_mention_id := (SELECT regexp_replace(p_url, '^/mention/([a-f0-9-]{36})(?:[/?]|$).*', '\1', 'i'))::UUID;
      IF EXISTS (SELECT 1 FROM public.map_pins WHERE id = v_mention_id AND is_active = true) THEN
        RETURN QUERY SELECT 'pin'::TEXT, v_mention_id;
        RETURN;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Invalid UUID, continue
    END;
  END IF;
  
  -- Check for post: /post/{id}
  v_post_id := analytics.extract_post_id_from_url(p_url);
  IF v_post_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.posts WHERE id = v_post_id) THEN
      RETURN QUERY SELECT 'post'::TEXT, v_post_id;
      RETURN;
    END IF;
  END IF;
  
  -- Check for map: /map/{id} or /map/{slug}
  SELECT e.entity_id INTO v_map_id
  FROM analytics.extract_map_entity_from_url(p_url) e
  LIMIT 1;
  
  IF v_map_id IS NOT NULL THEN
    RETURN QUERY SELECT 'map'::TEXT, v_map_id;
    RETURN;
  END IF;
  
  -- Check for profile: /profile/{username} or /{username}
  v_profile_account_id := analytics.extract_profile_account_id_from_url(p_url);
  IF v_profile_account_id IS NOT NULL THEN
    RETURN QUERY SELECT 'profile'::TEXT, v_profile_account_id;
    RETURN;
  END IF;
  
  -- Check if it's a known page type
  IF p_url IN ('/', '/feed', '/maps', '/live', '/explore', '/settings', '/analytics', '/contact', '/onboarding') OR
     p_url LIKE '/explore/%' OR
     p_url LIKE '/settings/%' OR
     p_url LIKE '/gov/%' OR
     p_url LIKE '/admin/%' THEN
    RETURN QUERY SELECT 'page'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  
  -- Default: other
  RETURN QUERY SELECT 'other'::TEXT, NULL::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 5: Update record_url_visit to also populate analytics.events
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
  v_entity_result RECORD;
BEGIN
  -- Validate URL
  IF p_url IS NULL OR LENGTH(TRIM(p_url)) = 0 THEN
    RAISE EXCEPTION 'url cannot be empty';
  END IF;
  
  -- Insert URL visit record (existing behavior)
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
  
  -- Extract entity relationship
  SELECT * INTO v_entity_result FROM analytics.extract_entity_from_url(TRIM(p_url));
  
  -- Insert into analytics.events (new structured tracking)
  INSERT INTO analytics.events (
    account_id,
    session_id,
    entity_type,
    entity_id,
    url,
    url_visit_id,
    viewed_at,
    user_agent,
    referrer_url,
    metadata
  )
  VALUES (
    p_account_id,
    p_session_id,
    v_entity_result.entity_type,
    v_entity_result.entity_id,
    TRIM(p_url),
    v_visit_id,
    NOW(),
    p_user_agent,
    p_referrer_url,
    '{}'::jsonb
  );
  
  -- Existing view count logic (keep for backward compatibility)
  -- Check if this is a profile page view and increment account view_count
  IF TRIM(p_url) LIKE '/profile/%' OR (TRIM(p_url) LIKE '/%' AND TRIM(p_url) NOT LIKE '/%/%') THEN
    v_profile_username := public.extract_profile_username_from_url(TRIM(p_url));
    
    -- Also try single-segment path
    IF v_profile_username IS NULL OR v_profile_username = '' THEN
      v_profile_username := (SELECT regexp_replace(TRIM(p_url), '^/([^/?]+)(?:[/?]|$).*', '\1', 'i'));
      IF v_profile_username IN ('feed', 'maps', 'live', 'explore', 'settings', 'analytics', 'gov', 'contact', 'onboarding', 'billing', 'admin') THEN
        v_profile_username := NULL;
      END IF;
    END IF;
    
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
    -- Increment view_count for the pin (map_pins table)
    UPDATE public.map_pins
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = v_mention_id;
  END IF;
  
  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Enable Row Level Security
-- ============================================================================

ALTER TABLE analytics.events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS Policies
-- ============================================================================

-- Anyone can insert events (via function)
DROP POLICY IF EXISTS "Anyone can insert events" ON analytics.events;
CREATE POLICY "Anyone can insert events"
  ON analytics.events FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Users can view their own events
DROP POLICY IF EXISTS "Users can view own events" ON analytics.events;
CREATE POLICY "Users can view own events"
  ON analytics.events FOR SELECT
  TO authenticated
  USING (account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1));

-- PRO users can view events for their content (profiles, pins, maps, posts)
DROP POLICY IF EXISTS "PRO users can view content events" ON analytics.events;
CREATE POLICY "PRO users can view content events"
  ON analytics.events FOR SELECT
  TO authenticated
  USING (
    -- Profile views
    (entity_type = 'profile' AND entity_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)) OR
    -- Pin views (check if user owns the pin)
    (entity_type = 'pin' AND EXISTS (
      SELECT 1 FROM public.map_pins mp
      JOIN public.accounts a ON mp.account_id = a.id
      WHERE mp.id = analytics.events.entity_id AND a.user_id = auth.uid()
    )) OR
    -- Map views (check if user owns the map)
    (entity_type = 'map' AND EXISTS (
      SELECT 1 FROM public.map m
      JOIN public.accounts a ON m.account_id = a.id
      WHERE m.id = analytics.events.entity_id AND a.user_id = auth.uid()
    )) OR
    -- Post views (check if user owns the post)
    (entity_type = 'post' AND EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.accounts a ON p.account_id = a.id
      WHERE p.id = analytics.events.entity_id AND a.user_id = auth.uid()
    ))
  );

-- Admins can view all events
DROP POLICY IF EXISTS "Admins can view all events" ON analytics.events;
CREATE POLICY "Admins can view all events"
  ON analytics.events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT INSERT ON analytics.events TO anon, authenticated;
GRANT SELECT ON analytics.events TO authenticated;
GRANT USAGE ON SCHEMA analytics TO authenticated;

-- ============================================================================
-- STEP 9: Backfill existing url_visits into analytics.events
-- ============================================================================

-- Migrate existing data (run in batches to avoid locking)
-- Note: This is a one-time backfill. For large datasets, run this manually in batches
DO $$
DECLARE
  v_batch_size INTEGER := 10000;
  v_processed INTEGER;
BEGIN
  LOOP
    INSERT INTO analytics.events (
      account_id,
      session_id,
      entity_type,
      entity_id,
      url,
      url_visit_id,
      viewed_at,
      user_agent,
      referrer_url,
      metadata
    )
    SELECT 
      uv.account_id,
      uv.session_id,
      COALESCE(e.entity_type, 'other')::TEXT,
      e.entity_id,
      uv.url,
      uv.id,
      uv.viewed_at,
      uv.user_agent,
      uv.referrer_url,
      '{}'::jsonb
    FROM public.url_visits uv
    CROSS JOIN LATERAL analytics.extract_entity_from_url(uv.url) e
    WHERE NOT EXISTS (
      SELECT 1 FROM analytics.events ae WHERE ae.url_visit_id = uv.id
    )
    LIMIT v_batch_size;
    
    GET DIAGNOSTICS v_processed = ROW_COUNT;
    EXIT WHEN v_processed = 0;
    
    -- Small delay to avoid locking
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 10: Create RPC wrapper functions for PostgREST access
-- ============================================================================

-- Get user's analytics events (for history page)
CREATE OR REPLACE FUNCTION public.get_user_analytics_events(
  p_account_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  entity_id UUID,
  url TEXT,
  viewed_at TIMESTAMPTZ,
  referrer_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.entity_type,
    e.entity_id,
    e.url,
    e.viewed_at,
    e.referrer_url
  FROM analytics.events e
  WHERE e.account_id = p_account_id
  ORDER BY e.viewed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count user's analytics events
CREATE OR REPLACE FUNCTION public.count_user_analytics_events(
  p_account_id UUID
)
RETURNS BIGINT AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM analytics.events
  WHERE account_id = p_account_id;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get entity stats from analytics.events
CREATE OR REPLACE FUNCTION public.get_entity_stats(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_events AS (
    SELECT 
      e.account_id,
      e.session_id
    FROM analytics.events e
    WHERE e.entity_type = p_entity_type
      AND e.entity_id = p_entity_id
      AND (p_hours IS NULL OR e.viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL)
  )
  SELECT 
    COUNT(*)::BIGINT AS total_views,
    (
      COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL) +
      COUNT(DISTINCT session_id) FILTER (WHERE account_id IS NULL AND session_id IS NOT NULL)
    )::BIGINT AS unique_viewers,
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM filtered_events;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count events by entity type and IDs (for batch queries)
CREATE OR REPLACE FUNCTION public.count_entity_events(
  p_entity_type TEXT,
  p_entity_ids UUID[],
  p_exclude_account_id UUID DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_count BIGINT;
  v_filter TEXT;
BEGIN
  -- Build filter for excluding self-views
  IF p_exclude_account_id IS NOT NULL THEN
    v_filter := format('account_id IS NULL OR account_id != %L', p_exclude_account_id);
  ELSE
    v_filter := 'true';
  END IF;
  
  EXECUTE format(
    'SELECT COUNT(*) FROM analytics.events WHERE entity_type = %L AND entity_id = ANY(%L) AND %s',
    p_entity_type,
    p_entity_ids,
    v_filter
  ) INTO v_count;
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_analytics_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_analytics_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_entity_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.count_entity_events TO authenticated;

-- ============================================================================
-- STEP 11: Add comments
-- ============================================================================

COMMENT ON TABLE analytics.events IS
  'Structured analytics events with direct entity relationships. Complements url_visits with queryable relationships for better analytics.';

COMMENT ON COLUMN analytics.events.entity_type IS
  'Type of entity: map, pin, profile, post, page, or other';

COMMENT ON COLUMN analytics.events.entity_id IS
  'UUID of the entity (NULL for page/other types)';

COMMENT ON COLUMN analytics.events.url_visit_id IS
  'Reference to the original url_visits record for backward compatibility';

COMMENT ON FUNCTION analytics.extract_entity_from_url IS
  'Extracts entity type and ID from a URL. Returns entity_type and entity_id for structured tracking.';

COMMENT ON FUNCTION public.record_url_visit IS
  'Records URL visits and automatically creates structured analytics.events records with entity relationships.';
