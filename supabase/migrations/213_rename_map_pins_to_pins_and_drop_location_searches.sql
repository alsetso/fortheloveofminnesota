-- Rename map_pins table to pins and drop location_searches table
-- This migration consolidates map_pins into the pins table name

-- ============================================================================
-- STEP 1: Drop existing pins table if it exists (to avoid conflict)
-- ============================================================================

DROP TABLE IF EXISTS public.pins CASCADE;

-- ============================================================================
-- STEP 2: Rename map_pins table to pins
-- ============================================================================

ALTER TABLE public.map_pins RENAME TO pins;

-- ============================================================================
-- STEP 3: Rename all indexes from idx_map_pins_* to idx_pins_*
-- ============================================================================

ALTER INDEX IF EXISTS idx_map_pins_lat_lng RENAME TO idx_pins_lat_lng;
ALTER INDEX IF EXISTS idx_map_pins_type RENAME TO idx_pins_type;
ALTER INDEX IF EXISTS idx_map_pins_account_id RENAME TO idx_pins_account_id;
ALTER INDEX IF EXISTS idx_map_pins_post_id RENAME TO idx_pins_post_id;
ALTER INDEX IF EXISTS idx_map_pins_city_id RENAME TO idx_pins_city_id;
ALTER INDEX IF EXISTS idx_map_pins_county_id RENAME TO idx_pins_county_id;
ALTER INDEX IF EXISTS idx_map_pins_created_at RENAME TO idx_pins_created_at;
ALTER INDEX IF EXISTS idx_map_pins_visibility RENAME TO idx_pins_visibility;
ALTER INDEX IF EXISTS idx_map_pins_view_count RENAME TO idx_pins_view_count;
ALTER INDEX IF EXISTS idx_map_pins_media_url RENAME TO idx_pins_media_url;

-- ============================================================================
-- STEP 4: Rename trigger function and trigger
-- ============================================================================

-- Drop old trigger first
DROP TRIGGER IF EXISTS update_map_pins_updated_at ON public.pins;

-- Rename function if it exists (ALTER FUNCTION doesn't support IF EXISTS, so use DO block)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_map_pins_updated_at' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER FUNCTION public.update_map_pins_updated_at() RENAME TO update_pins_updated_at;
  END IF;
END $$;

-- Recreate trigger with new name
CREATE TRIGGER update_pins_updated_at
  BEFORE UPDATE ON public.pins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pins_updated_at();

-- ============================================================================
-- STEP 5: Update RLS policies to reference pins instead of map_pins
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Public read access for map pins" ON public.pins;
DROP POLICY IF EXISTS "Read map pins based on visibility" ON public.pins;
DROP POLICY IF EXISTS "Users can insert own map pins" ON public.pins;
DROP POLICY IF EXISTS "Users can update own map pins" ON public.pins;
DROP POLICY IF EXISTS "Users can delete own map pins" ON public.pins;

-- Recreate policies with updated names and references
CREATE POLICY "Public read access for pins"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public pins are visible to everyone
    visibility = 'public'
    OR
    -- Private pins are only visible to their creator
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = pins.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own pins"
  ON public.pins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

CREATE POLICY "Users can update own pins"
  ON public.pins
  FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

CREATE POLICY "Users can delete own pins"
  ON public.pins
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 6: Update record_page_view function to use 'pins' instead of 'map_pins'
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
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
  END LOOP;
END $$;

-- Create the updated function with 'pin' instead of 'map_pin' and 'pins' instead of 'map_pins'
CREATE FUNCTION public.record_page_view(
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_slug TEXT DEFAULT NULL,
  p_account_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_view_count INTEGER;
  v_table_name TEXT;
  v_entity_id_for_update UUID;
BEGIN
  -- Validate entity_type (update 'map_pin' to 'pin')
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'account', 'business', 'feed', 'map', 'pin', 'homepage', 'explore', 'cities_list', 'counties_list', 'contact') THEN
    RAISE EXCEPTION 'Invalid entity_type: %', p_entity_type;
  END IF;
  
  -- Map entity_type to table name (update 'map_pins' to 'pins')
  v_table_name := CASE p_entity_type
    WHEN 'post' THEN 'posts'
    WHEN 'article' THEN 'articles'
    WHEN 'city' THEN 'cities'
    WHEN 'county' THEN 'counties'
    WHEN 'account' THEN 'accounts'
    WHEN 'business' THEN 'businesses'
    WHEN 'pin' THEN 'pins'
    ELSE NULL
  END;
  
  -- Resolve entity_id based on entity_type and provided identifiers
  IF p_entity_id IS NOT NULL THEN
    v_entity_id_for_update := p_entity_id;
  ELSIF p_entity_slug IS NOT NULL THEN
    CASE p_entity_type
      WHEN 'post' THEN
        SELECT id INTO v_entity_id_for_update FROM public.posts WHERE slug = p_entity_slug LIMIT 1;
      WHEN 'city' THEN
        SELECT id INTO v_entity_id_for_update FROM public.cities WHERE slug = p_entity_slug OR name = p_entity_slug LIMIT 1;
      WHEN 'county' THEN
        SELECT id INTO v_entity_id_for_update FROM public.counties WHERE slug = p_entity_slug OR name = p_entity_slug LIMIT 1;
      WHEN 'account' THEN
        SELECT id INTO v_entity_id_for_update FROM public.accounts WHERE username = p_entity_slug LIMIT 1;
      ELSE
        v_entity_id_for_update := NULL;
    END CASE;
  ELSE
    v_entity_id_for_update := NULL;
  END IF;
  
  -- Insert page view record with enhanced data
  INSERT INTO public.page_views (
    entity_type,
    entity_id,
    entity_slug,
    account_id,
    ip_address,
    referrer_url,
    session_id,
    user_agent,
    viewed_at
  ) VALUES (
    p_entity_type,
    v_entity_id_for_update,
    p_entity_slug,
    p_account_id,
    p_ip_address,
    p_referrer_url,
    p_session_id,
    p_user_agent,
    NOW()
  );
  
  -- Update view_count on entity table if applicable
  IF v_entity_id_for_update IS NOT NULL AND v_table_name IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'UPDATE public.%I SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1 RETURNING view_count',
        v_table_name
      )
      USING v_entity_id_for_update
      INTO v_view_count;
    EXCEPTION
      WHEN undefined_column THEN
        v_view_count := 0;
        RAISE WARNING 'view_count column does not exist on table %', v_table_name;
    END;
  ELSE
    v_view_count := 0;
  END IF;
  
  RETURN COALESCE(v_view_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: Update page_views table constraint to use 'pin' instead of 'map_pin'
-- ============================================================================

ALTER TABLE public.page_views
  DROP CONSTRAINT IF EXISTS page_views_entity_type_check;

ALTER TABLE public.page_views
  ADD CONSTRAINT page_views_entity_type_check 
  CHECK (entity_type IN ('post', 'article', 'city', 'county', 'account', 'business', 'page', 'feed', 'map', 'pin', 'homepage', 'explore', 'cities_list', 'counties_list', 'contact'));

-- ============================================================================
-- STEP 8: Update get_map_pin_stats function to use pins table
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_map_pin_stats(
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
  SELECT 
    -- Total views: count of all page views for this pin
    COUNT(*)::BIGINT AS total_views,
    
    -- Unique viewers: distinct accounts + distinct IPs (for anonymous)
    (
      COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL) +
      COUNT(DISTINCT ip_address) FILTER (WHERE account_id IS NULL AND ip_address IS NOT NULL)
    )::BIGINT AS unique_viewers,
    
    -- Accounts viewed: distinct accounts that viewed the pin
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL)::BIGINT AS accounts_viewed
  FROM public.page_views
  WHERE entity_type = 'pin'
    AND entity_id = p_pin_id
    AND (p_hours IS NULL OR viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 9: Update comments to reflect the rename
-- ============================================================================

COMMENT ON TABLE public.pins IS 'Public map pins that are readable by everyone. Authenticated users can manage their own pins.';
COMMENT ON COLUMN public.pins.lat IS 'Latitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.pins.lng IS 'Longitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.pins.description IS 'Text content for the pin (single source of text)';
COMMENT ON COLUMN public.pins.type IS 'Pin type/category for filtering';
COMMENT ON COLUMN public.pins.account_id IS 'Account that owns this pin (required for authenticated users)';
COMMENT ON COLUMN public.pins.post_id IS 'Optional reference to a post';
COMMENT ON COLUMN public.pins.city_id IS 'Optional reference to a city (stored as UUID, no foreign key constraint)';
COMMENT ON COLUMN public.pins.county_id IS 'Optional reference to a county (stored as UUID, no foreign key constraint)';
COMMENT ON COLUMN public.pins.visibility IS 'Pin visibility: ''public'' (visible to everyone) or ''only_me'' (visible only to creator). Extensible for future types.';
COMMENT ON COLUMN public.pins.view_count IS 'Total number of times this pin has been viewed (incremented via record_page_view function)';
COMMENT ON COLUMN public.pins.media_url IS 'URL to photo or video associated with this pin (one media item per pin)';

-- ============================================================================
-- STEP 10: Update page_views RLS policy to use 'pin' instead of 'map_pin' and 'pins' instead of 'map_pins'
-- ============================================================================

DROP POLICY IF EXISTS "page_views_select_own" ON public.page_views;

CREATE POLICY "page_views_select_own" ON public.page_views
  FOR SELECT
  USING (
    -- For account profiles, check if viewing own profile's visitors
    (entity_type = 'account' AND entity_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)) OR
    -- For posts, check ownership via account_id
    (entity_type = 'post' AND EXISTS (
      SELECT 1 FROM public.posts WHERE id = page_views.entity_id AND account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
    )) OR
    -- For pages, check ownership via account_id
    (entity_type = 'page' AND EXISTS (
      SELECT 1 FROM public.pages WHERE id = page_views.entity_id AND account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
    )) OR
    -- For pins, check ownership via account_id (updated from map_pins)
    (entity_type = 'pin' AND EXISTS (
      SELECT 1 FROM public.pins WHERE id = page_views.entity_id AND account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
    )) OR
    -- For homepage, allow all authenticated users to see homepage stats (shared entity)
    (entity_type = 'homepage' AND auth.uid() IS NOT NULL)
  );

COMMENT ON POLICY "page_views_select_own" ON public.page_views IS
  'Allows users to view page_views for their own content (accounts, posts, pages, pins) and homepage views (shared, all authenticated users can see).';

-- ============================================================================
-- STEP 11: Update analytics_aggregates RLS policy to use 'pin' instead of 'map_pin' and 'pins' instead of 'map_pins'
-- ============================================================================

DROP POLICY IF EXISTS "analytics_aggregates_select_own" ON public.analytics_aggregates;

CREATE POLICY "analytics_aggregates_select_own" ON public.analytics_aggregates
  FOR SELECT
  USING (
    -- For account entities, user must own the account
    (entity_type = 'account' AND entity_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )) OR
    -- For post entities, user must own the post
    (entity_type = 'post' AND entity_id IN (
      SELECT id FROM public.posts WHERE account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    )) OR
    -- For pin entities, user must own the pin (updated from map_pins)
    (entity_type = 'pin' AND entity_id IN (
      SELECT id FROM public.pins WHERE account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    ))
  );

-- ============================================================================
-- STEP 12: Drop location_searches table
-- ============================================================================

DROP TABLE IF EXISTS public.location_searches CASCADE;


