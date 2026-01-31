-- Consolidate analytics to events table as single source of truth
-- Make url_visits a view, drop map_views, update all functions

-- ============================================================================
-- STEP 1: Remove url_visit_id from events (events becomes primary)
-- ============================================================================

-- Drop foreign key constraint
ALTER TABLE analytics.events
  DROP CONSTRAINT IF EXISTS events_url_visit_id_fkey;

-- Drop column (will be recreated as computed if needed)
ALTER TABLE analytics.events
  DROP COLUMN IF EXISTS url_visit_id;

-- ============================================================================
-- STEP 2: Migrate any remaining url_visits data to events
-- ============================================================================

-- Insert any url_visits that don't have corresponding events
INSERT INTO analytics.events (
  account_id,
  session_id,
  entity_type,
  entity_id,
  url,
  viewed_at,
  user_agent,
  referrer_url,
  metadata
)
SELECT 
  uv.account_id,
  uv.session_id,
  COALESCE(
    (SELECT entity_type FROM analytics.events e WHERE e.url = uv.url LIMIT 1),
    CASE 
      WHEN uv.url LIKE '/map/%' THEN 'map'
      WHEN uv.url LIKE '%?pin=%' OR uv.url LIKE '%?pinId=%' THEN 'pin'
      WHEN uv.url LIKE '/profile/%' THEN 'profile'
      WHEN uv.url LIKE '/post/%' THEN 'post'
      ELSE 'page'
    END
  )::TEXT,
  COALESCE(
    (SELECT entity_id FROM analytics.events e WHERE e.url = uv.url LIMIT 1),
    CASE 
      WHEN uv.url LIKE '/map/%' THEN 
        (SELECT regexp_replace(uv.url, '^/map/([a-f0-9-]{36})(?:[/?]|$).*', '\1', 'i'))::UUID
      WHEN uv.url LIKE '%?pin=%' OR uv.url LIKE '%?pinId=%' THEN
        public.extract_mention_id_from_url(uv.url)
      WHEN uv.url LIKE '/profile/%' THEN
        (SELECT id FROM public.accounts WHERE username = public.extract_profile_username_from_url(uv.url) LIMIT 1)
      ELSE NULL
    END
  ),
  uv.url,
  uv.viewed_at,
  uv.user_agent,
  uv.referrer_url,
  '{}'::jsonb
FROM analytics.url_visits uv
WHERE NOT EXISTS (
  SELECT 1 FROM analytics.events e 
  WHERE e.url = uv.url 
  AND e.account_id IS NOT DISTINCT FROM uv.account_id
  AND e.session_id IS NOT DISTINCT FROM uv.session_id
  AND ABS(EXTRACT(EPOCH FROM (e.viewed_at - uv.viewed_at))) < 1
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: Drop map_views and special_map_views tables
-- ============================================================================

DROP TABLE IF EXISTS analytics.map_views CASCADE;
DROP TABLE IF EXISTS analytics.special_map_views CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS analytics.record_map_view(UUID, UUID, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS analytics.record_special_map_view(TEXT, UUID, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_map_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_map_viewers(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.record_map_view(UUID, UUID, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_viewers(UUID, INTEGER, INTEGER) CASCADE;

-- ============================================================================
-- STEP 4: Drop analytics.url_visits table (will become a view)
-- ============================================================================

DROP TABLE IF EXISTS analytics.url_visits CASCADE;

-- ============================================================================
-- STEP 5: Create url_visits as a view over events
-- ============================================================================

CREATE OR REPLACE VIEW analytics.url_visits AS
SELECT 
  id,
  url,
  account_id,
  viewed_at,
  user_agent,
  referrer_url,
  session_id
FROM analytics.events;

-- Create public view for backward compatibility
CREATE OR REPLACE VIEW public.url_visits AS
SELECT * FROM analytics.url_visits;

-- ============================================================================
-- STEP 6: Create INSTEAD OF trigger for INSERT on url_visits view
-- ============================================================================

CREATE OR REPLACE FUNCTION public.url_visits_insert_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_result RECORD;
BEGIN
  -- Extract entity relationship
  SELECT * INTO v_entity_result FROM analytics.extract_entity_from_url(TRIM(NEW.url));
  
  -- Insert into events (the single source of truth)
  INSERT INTO analytics.events (
    account_id,
    session_id,
    entity_type,
    entity_id,
    url,
    viewed_at,
    user_agent,
    referrer_url,
    metadata
  ) VALUES (
    NEW.account_id,
    NEW.session_id,
    v_entity_result.entity_type,
    v_entity_result.entity_id,
    TRIM(NEW.url),
    COALESCE(NEW.viewed_at, NOW()),
    NEW.user_agent,
    NEW.referrer_url,
    '{}'::jsonb
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS url_visits_instead_of_insert ON public.url_visits;
CREATE TRIGGER url_visits_instead_of_insert
  INSTEAD OF INSERT ON public.url_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.url_visits_insert_trigger();

-- ============================================================================
-- STEP 7: Update record_url_visit to write ONLY to events
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
  v_event_id UUID;
  v_profile_username TEXT;
  v_profile_account_id UUID;
  v_mention_id UUID;
  v_entity_result RECORD;
BEGIN
  -- Validate URL
  IF p_url IS NULL OR LENGTH(TRIM(p_url)) = 0 THEN
    RAISE EXCEPTION 'url cannot be empty';
  END IF;
  
  -- Extract entity relationship
  SELECT * INTO v_entity_result FROM analytics.extract_entity_from_url(TRIM(p_url));
  
  -- Insert into analytics.events (single source of truth)
  INSERT INTO analytics.events (
    account_id,
    session_id,
    entity_type,
    entity_id,
    url,
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
    NOW(),
    p_user_agent,
    p_referrer_url,
    '{}'::jsonb
  )
  RETURNING id INTO v_event_id;
  
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
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: Update aggregation functions to use events
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
  WITH filtered_events AS (
    SELECT 
      account_id,
      session_id
    FROM analytics.events
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
  FROM filtered_events;
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
  WITH filtered_events AS (
    SELECT 
      e.account_id,
      e.session_id
    FROM analytics.events e
    WHERE e.entity_type = 'pin'
      AND e.entity_id = p_mention_id
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
  SELECT DISTINCT ON (e.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(e.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM analytics.events e
  LEFT JOIN public.accounts a ON e.account_id = a.id
  WHERE e.entity_type = 'pin'
    AND e.entity_id = p_mention_id
    AND e.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, e.account_id
  ORDER BY e.account_id, MAX(e.viewed_at) DESC
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
DECLARE
  v_profile_account_id UUID;
BEGIN
  -- Get profile account ID
  SELECT id INTO v_profile_account_id
  FROM public.accounts
  WHERE LOWER(TRIM(username)) = LOWER(p_username)
  LIMIT 1;
  
  RETURN QUERY
  SELECT DISTINCT ON (e.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(e.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM analytics.events e
  LEFT JOIN public.accounts a ON e.account_id = a.id
  WHERE e.entity_type = 'profile'
    AND e.entity_id = v_profile_account_id
    AND e.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, e.account_id
  ORDER BY e.account_id, MAX(e.viewed_at) DESC
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
  SELECT DISTINCT ON (e.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(e.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM analytics.events e
  LEFT JOIN public.accounts a ON e.account_id = a.id
  WHERE e.entity_type = 'map'
    AND e.entity_id = p_map_id
    AND e.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, e.account_id
  ORDER BY e.account_id, MAX(e.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 9: Update RLS policies on url_visits view (delegates to events)
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can record URL visits" ON analytics.url_visits;
DROP POLICY IF EXISTS "Users can view own URL visits" ON analytics.url_visits;
DROP POLICY IF EXISTS "PRO users can view profile visitors" ON analytics.url_visits;
DROP POLICY IF EXISTS "PRO users can view mention visitors" ON analytics.url_visits;
DROP POLICY IF EXISTS "Admins can view all URL visits" ON analytics.url_visits;

-- Views inherit RLS from underlying table, but we need to grant permissions
GRANT SELECT ON analytics.url_visits TO authenticated;
GRANT INSERT ON analytics.url_visits TO anon, authenticated;

-- ============================================================================
-- STEP 10: Update get_account_map_views functions to use events
-- ============================================================================

CREATE OR REPLACE FUNCTION analytics.get_account_map_views(
  p_account_id UUID,
  p_date_range TEXT DEFAULT '30',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  map_id UUID,
  map_name TEXT,
  map_slug TEXT,
  view_count BIGINT,
  last_viewed TIMESTAMP WITH TIME ZONE,
  first_viewed TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_date_filter TEXT;
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS map_id,
    m.name AS map_name,
    m.slug AS map_slug,
    COUNT(*)::BIGINT AS view_count,
    MAX(e.viewed_at) AS last_viewed,
    MIN(e.viewed_at) AS first_viewed
  FROM analytics.events e
  INNER JOIN public.map m ON m.id = e.entity_id
  WHERE e.account_id = p_account_id
    AND e.entity_type = 'map'
    AND m.is_active = true
    AND (
      p_date_range = 'all' OR
      (p_date_range = '30' AND e.viewed_at >= NOW() - INTERVAL '30 days') OR
      (p_date_range = '90' AND e.viewed_at >= NOW() - INTERVAL '90 days')
    )
  GROUP BY m.id, m.name, m.slug
  ORDER BY MAX(e.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION analytics.get_account_map_views_count(
  p_account_id UUID,
  p_date_range TEXT DEFAULT '30'
)
RETURNS TABLE (
  total_count BIGINT,
  total_views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT e.entity_id)::BIGINT AS total_count,
    COUNT(*)::BIGINT AS total_views
  FROM analytics.events e
  INNER JOIN public.map m ON m.id = e.entity_id
  WHERE e.account_id = p_account_id
    AND e.entity_type = 'map'
    AND m.is_active = true
    AND (
      p_date_range = 'all' OR
      (p_date_range = '30' AND e.viewed_at >= NOW() - INTERVAL '30 days') OR
      (p_date_range = '90' AND e.viewed_at >= NOW() - INTERVAL '90 days')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 11: Add comments
-- ============================================================================

COMMENT ON VIEW analytics.url_visits IS 
  'View over analytics.events providing url_visits interface for backward compatibility. Events is the single source of truth.';

COMMENT ON VIEW public.url_visits IS 
  'Public view for Supabase client compatibility. Points to analytics.url_visits view, which queries analytics.events.';

COMMENT ON FUNCTION public.record_url_visit IS 
  'Records a URL visit into analytics.events (single source of truth). Also updates view counts for profiles and mentions.';

COMMENT ON TABLE analytics.events IS 
  'Single source of truth for all analytics events. Tracks views with entity relationships (map, pin, profile, post, page).';
