-- Move url_visits table from public schema to analytics schema
-- Create public view for backward compatibility

-- ============================================================================
-- STEP 1: Ensure analytics schema exists
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant usage on schema
GRANT USAGE ON SCHEMA analytics TO authenticated;
GRANT USAGE ON SCHEMA analytics TO anon;

-- ============================================================================
-- STEP 2: Create url_visits table in analytics schema
-- ============================================================================

CREATE TABLE analytics.url_visits (
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
-- STEP 3: Migrate data from public.url_visits to analytics.url_visits
-- ============================================================================

INSERT INTO analytics.url_visits (
  id, url, account_id, viewed_at, user_agent, referrer_url, session_id
)
SELECT 
  id, url, account_id, viewed_at, user_agent, referrer_url, session_id
FROM public.url_visits
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: Create indexes on analytics.url_visits
-- ============================================================================

CREATE INDEX idx_url_visits_url ON analytics.url_visits(url);
CREATE INDEX idx_url_visits_account_id ON analytics.url_visits(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_url_visits_viewed_at ON analytics.url_visits(viewed_at DESC);
CREATE INDEX idx_url_visits_url_viewed_at ON analytics.url_visits(url, viewed_at DESC);
CREATE INDEX idx_url_visits_account_url ON analytics.url_visits(account_id, url, viewed_at DESC) WHERE account_id IS NOT NULL;
CREATE INDEX idx_url_visits_session_id ON analytics.url_visits(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_url_visits_session_url ON analytics.url_visits(session_id, url, viewed_at DESC) WHERE account_id IS NULL AND session_id IS NOT NULL;
CREATE INDEX idx_url_visits_authenticated ON analytics.url_visits(account_id, url, viewed_at DESC) WHERE account_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Update foreign key in analytics.events
-- ============================================================================

-- Drop old foreign key constraint if it exists
ALTER TABLE analytics.events
  DROP CONSTRAINT IF EXISTS events_url_visit_id_fkey;

-- Add new foreign key pointing to analytics.url_visits
ALTER TABLE analytics.events
  ADD CONSTRAINT events_url_visit_id_fkey
  FOREIGN KEY (url_visit_id) REFERENCES analytics.url_visits(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 6: Update record_url_visit function to use analytics.url_visits
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
  
  -- Insert URL visit record into analytics.url_visits
  INSERT INTO analytics.url_visits (
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
  
  -- Extract entity relationship for analytics.events
  SELECT * INTO v_entity_result FROM analytics.extract_entity_from_url(TRIM(p_url));
  
  -- Insert into analytics.events (if function exists)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'extract_entity_from_url' AND pronamespace = 'analytics'::regnamespace) THEN
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
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Check if this is a profile page view and increment account view_count
  IF TRIM(p_url) LIKE '/profile/%' OR (TRIM(p_url) LIKE '/%' AND TRIM(p_url) NOT LIKE '/%/%') THEN
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
-- STEP 7: Update aggregation functions to use analytics.url_visits
-- ============================================================================

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
    FROM analytics.url_visits
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
    FROM analytics.url_visits uv
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
  FROM analytics.url_visits uv
  LEFT JOIN public.accounts a ON uv.account_id = a.id
  WHERE public.extract_mention_id_from_url(uv.url) = p_mention_id
    AND uv.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, uv.account_id
  ORDER BY uv.account_id, MAX(uv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  FROM analytics.url_visits uv
  LEFT JOIN public.accounts a ON uv.account_id = a.id
  WHERE uv.url LIKE '/profile/' || p_username || '%'
    AND uv.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, uv.account_id
  ORDER BY uv.account_id, MAX(uv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  FROM analytics.url_visits uv
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
-- STEP 8: Enable RLS on analytics.url_visits
-- ============================================================================

ALTER TABLE analytics.url_visits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: Create RLS policies on analytics.url_visits
-- ============================================================================

-- Anyone can insert URL visits (for tracking)
CREATE POLICY "Anyone can record URL visits"
  ON analytics.url_visits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view their own URL visits (where they are the viewer)
CREATE POLICY "Users can view own URL visits"
  ON analytics.url_visits FOR SELECT
  TO authenticated
  USING (
    account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
  );

-- PRO users can view visitors to their own profile
CREATE POLICY "PRO users can view profile visitors"
  ON analytics.url_visits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.user_id = auth.uid()
        AND a.plan = 'pro'
        AND analytics.url_visits.url LIKE '/profile/' || a.username || '%'
    )
  );

-- PRO users can view visitors to their own mentions
CREATE POLICY "PRO users can view mention visitors"
  ON analytics.url_visits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentions m
      JOIN public.accounts a ON m.account_id = a.id
      WHERE a.user_id = auth.uid()
        AND a.plan = 'pro'
        AND public.extract_mention_id_from_url(analytics.url_visits.url) = m.id
    )
  );

-- Admins can view all URL visits
CREATE POLICY "Admins can view all URL visits"
  ON analytics.url_visits FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 10: Grant permissions on analytics.url_visits
-- ============================================================================

GRANT INSERT ON analytics.url_visits TO anon, authenticated;
GRANT SELECT ON analytics.url_visits TO authenticated;

-- ============================================================================
-- STEP 11: Drop public.url_visits table (before creating view)
-- ============================================================================

DROP TABLE IF EXISTS public.url_visits CASCADE;

-- ============================================================================
-- STEP 12: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.url_visits AS
SELECT * FROM analytics.url_visits;

-- Grant permissions on the view
GRANT SELECT ON public.url_visits TO authenticated;
GRANT INSERT ON public.url_visits TO anon, authenticated;

-- Create INSTEAD OF triggers to make the view updatable
CREATE OR REPLACE FUNCTION public.url_visits_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO analytics.url_visits (
    id, url, account_id, viewed_at, user_agent, referrer_url, session_id
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.url,
    NEW.account_id,
    COALESCE(NEW.viewed_at, NOW()),
    NEW.user_agent,
    NEW.referrer_url,
    NEW.session_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER url_visits_instead_of_insert
  INSTEAD OF INSERT ON public.url_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.url_visits_insert_trigger();

-- ============================================================================
-- STEP 13: Add comments
-- ============================================================================

COMMENT ON TABLE analytics.url_visits IS
  'Unified URL-based view tracking. Tracks all page, map, and mention views via URLs. View counts are public; visitor identities (WHO) are PRO-only for content owners.';

COMMENT ON COLUMN analytics.url_visits.url IS
  'Full URL path with query params (e.g., "/explore/city/minneapolis", "/map?pin=uuid", "/profile/username").';

COMMENT ON COLUMN analytics.url_visits.account_id IS
  'Account ID of the viewer. NULL for anonymous visitors.';

COMMENT ON VIEW public.url_visits IS 'Public view for Supabase client compatibility. Points to analytics.url_visits table.';

COMMENT ON POLICY "PRO users can view profile visitors" ON analytics.url_visits IS
  'Allows PRO account owners to see WHO visited their profile (visitor identities).';

COMMENT ON POLICY "PRO users can view mention visitors" ON analytics.url_visits IS
  'Allows PRO account owners to see WHO viewed their mentions (visitor identities).';
