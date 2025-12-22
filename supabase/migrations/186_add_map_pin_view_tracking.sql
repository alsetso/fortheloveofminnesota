-- Add map_pin view tracking support
-- Enables tracking views for individual map pins when users open their popups

-- ============================================================================
-- STEP 1: Update page_views table constraint to include 'map_pin'
-- ============================================================================

ALTER TABLE public.page_views
  DROP CONSTRAINT IF EXISTS page_views_entity_type_check;

ALTER TABLE public.page_views
  ADD CONSTRAINT page_views_entity_type_check 
  CHECK (entity_type IN ('post', 'article', 'city', 'county', 'account', 'business', 'page', 'feed', 'map', 'map_pin'));

-- ============================================================================
-- STEP 2: Update record_page_view function to support 'map_pin' entity type
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_page_view(
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_slug TEXT DEFAULT NULL,
  p_account_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_view_count INTEGER;
  v_table_name TEXT;
  v_entity_id_for_update UUID;
BEGIN
  -- Validate entity_type
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'account', 'business', 'page', 'feed', 'map', 'map_pin') THEN
    RAISE EXCEPTION 'Invalid entity_type: %', p_entity_type;
  END IF;
  
  -- Map entity_type to table name
  v_table_name := CASE p_entity_type
    WHEN 'post' THEN 'posts'
    WHEN 'article' THEN 'articles'
    WHEN 'city' THEN 'cities'
    WHEN 'county' THEN 'counties'
    WHEN 'account' THEN 'accounts'
    WHEN 'business' THEN 'businesses'
    WHEN 'map_pin' THEN 'map_pins'
    ELSE NULL
  END;
  
  -- Resolve entity_id based on entity_type and provided identifiers
  IF p_entity_id IS NOT NULL THEN
    -- Direct entity_id provided - use it
    v_entity_id_for_update := p_entity_id;
  ELSIF p_entity_slug IS NOT NULL THEN
    -- Need to resolve slug to entity_id based on entity_type
    IF p_entity_type = 'account' THEN
      -- Accounts: resolve username to account_id
      SELECT id INTO v_entity_id_for_update
      FROM public.accounts
      WHERE username = p_entity_slug
      LIMIT 1;
    ELSIF p_entity_type IN ('post', 'article') THEN
      -- Posts/Articles: resolve slug to id
      EXECUTE format('SELECT id FROM public.%I WHERE slug = $1 LIMIT 1', v_table_name)
      USING p_entity_slug
      INTO v_entity_id_for_update;
    ELSIF p_entity_type IN ('city', 'county') THEN
      -- Cities/Counties: resolve slug to id
      EXECUTE format('SELECT id FROM public.%I WHERE slug = $1 LIMIT 1', v_table_name)
      USING p_entity_slug
      INTO v_entity_id_for_update;
    ELSIF p_entity_type IN ('business', 'page', 'feed', 'map') THEN
      -- Business/Page/Feed/Map pages: slugs don't resolve to entity_id
      -- These are page-level tracking, not entity-specific
      v_entity_id_for_update := NULL;
    ELSIF p_entity_type = 'map_pin' THEN
      -- Map pins use UUID entity_id, not slug
      -- If slug is provided, it's invalid
      RAISE EXCEPTION 'map_pin entity_type requires entity_id, not entity_slug';
    ELSE
      -- For other entity types, slug resolution not supported
      RAISE EXCEPTION 'Slug lookup not supported for entity_type: %', p_entity_type;
    END IF;
  ELSE
    -- For feed, business, page, and map page slugs, allow NULL entity_id
    IF p_entity_type IN ('feed', 'business', 'page', 'map') THEN
      v_entity_id_for_update := NULL;
    ELSIF p_entity_type = 'map_pin' THEN
      RAISE EXCEPTION 'map_pin entity_type requires entity_id';
    ELSE
      RAISE EXCEPTION 'Either entity_id or entity_slug must be provided';
    END IF;
  END IF;
  
  -- Insert page view record
  INSERT INTO public.page_views (
    entity_type,
    entity_id,
    entity_slug,
    account_id,
    ip_address,
    viewed_at
  )
  VALUES (
    p_entity_type,
    v_entity_id_for_update,
    CASE 
      WHEN p_entity_type = 'account' AND p_entity_slug IS NOT NULL THEN p_entity_slug
      WHEN p_entity_type IN ('post', 'article') AND p_entity_slug IS NOT NULL THEN p_entity_slug
      WHEN p_entity_type = 'feed' AND p_entity_slug IS NOT NULL THEN p_entity_slug
      WHEN p_entity_type IN ('business', 'page') AND p_entity_slug IS NOT NULL THEN p_entity_slug
      WHEN p_entity_type = 'map' AND p_entity_slug IS NOT NULL THEN p_entity_slug
      ELSE NULL
    END,
    p_account_id,
    p_ip_address,
    NOW()
  );
  
  -- Update view_count on entity table (only if table exists and has view_count column)
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
        -- Column doesn't exist, skip update but still record the page view
        v_view_count := 0;
        RAISE WARNING 'view_count column does not exist on table %', v_table_name;
    END;
  ELSE
    -- For feed, business, or map page slugs, return 0 (we track in page_views table)
    v_view_count := 0;
  END IF;
  
  RETURN COALESCE(v_view_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Add view_count column to map_pins table (optional, for quick access)
-- ============================================================================

ALTER TABLE public.map_pins
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Create index for view_count queries
CREATE INDEX IF NOT EXISTS idx_map_pins_view_count ON public.map_pins(view_count DESC)
  WHERE view_count > 0;

-- ============================================================================
-- STEP 4: Create function to get map pin statistics
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
  WHERE entity_type = 'map_pin'
    AND entity_id = p_pin_id
    AND (p_hours IS NULL OR viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_map_pin_stats TO anon, authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_map_pin_stats IS
  'Returns map pin statistics: total_views (all views), unique_viewers (distinct accounts + IPs), and accounts_viewed (distinct accounts only). p_hours parameter filters to last N hours (NULL = all time).';

-- ============================================================================
-- STEP 5: Add comments
-- ============================================================================

COMMENT ON COLUMN public.map_pins.view_count IS 'Total number of times this pin has been viewed (incremented via record_page_view function)';



