-- Add 'homepage' entity type support for analytics tracking
-- Enables tracking homepage loads as a distinct entity type

-- ============================================================================
-- STEP 1: Update page_views table constraint to include 'homepage'
-- ============================================================================

ALTER TABLE public.page_views
  DROP CONSTRAINT IF EXISTS page_views_entity_type_check;

ALTER TABLE public.page_views
  ADD CONSTRAINT page_views_entity_type_check 
  CHECK (entity_type IN ('post', 'article', 'city', 'county', 'account', 'business', 'page', 'feed', 'map', 'map_pin', 'homepage'));

-- ============================================================================
-- STEP 2: Update record_page_view function to support 'homepage' entity type
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
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'account', 'business', 'feed', 'map', 'map_pin', 'homepage') THEN
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
        -- For feed, map, homepage - no entity_id needed
        v_entity_id_for_update := NULL;
    END CASE;
  ELSE
    -- For homepage, feed, map - no entity_id needed
    v_entity_id_for_update := NULL;
  END IF;
  
  -- Insert page view record
  INSERT INTO public.page_views (
    entity_type,
    entity_id,
    entity_slug,
    account_id,
    ip_address,
    viewed_at
  ) VALUES (
    p_entity_type,
    v_entity_id_for_update,
    p_entity_slug,
    p_account_id,
    p_ip_address,
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
        -- Column doesn't exist, skip update but still record the page view
        v_view_count := 0;
        RAISE WARNING 'view_count column does not exist on table %', v_table_name;
    END;
  ELSE
    -- For feed, map, homepage - return 0 (we track in page_views table)
    v_view_count := 0;
  END IF;
  
  RETURN COALESCE(v_view_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.record_page_view IS
  'Records a page view for various entity types including homepage, feed, map, posts, cities, counties, accounts, and map pins. Returns the updated view_count for entities with view_count columns, or 0 for page-level entities (homepage, feed, map).';


