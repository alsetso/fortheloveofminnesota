-- Fix record_page_view function to handle feed and map entity types with slugs
-- These entity types don't resolve slugs to entity_id (they're page-level tracking)

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
  -- Validate entity_type (support both 'business' and 'page' for migration compatibility)
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'account', 'business', 'page', 'feed', 'map') THEN
    RAISE EXCEPTION 'Invalid entity_type: %', p_entity_type;
  END IF;
  
  -- Map entity_type to table name (both 'business' and 'page' map to 'pages')
  v_table_name := CASE p_entity_type
    WHEN 'post' THEN 'posts'
    WHEN 'article' THEN 'articles'
    WHEN 'city' THEN 'cities'
    WHEN 'county' THEN 'counties'
    WHEN 'account' THEN 'accounts'
    WHEN 'business' THEN 'pages'
    WHEN 'page' THEN 'pages'
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
    ELSIF p_entity_type IN ('business', 'page') THEN
      -- Page pages: 'business' or 'directory' slugs don't resolve to entity_id
      -- These are page-level tracking, not page-specific
      v_entity_id_for_update := NULL;
    ELSIF p_entity_type IN ('feed', 'map') THEN
      -- Feed/Map pages: slugs don't resolve to entity_id
      -- These are page-level tracking, not entity-specific
      v_entity_id_for_update := NULL;
    ELSE
      -- For other entity types, slug resolution not supported
      RAISE EXCEPTION 'Slug lookup not supported for entity_type: %', p_entity_type;
    END IF;
  ELSE
    -- For feed, business, page, or map page slugs, allow NULL entity_id
    IF p_entity_type IN ('feed', 'business', 'page', 'map') THEN
      v_entity_id_for_update := NULL;
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
    -- Normalize 'business' to 'page' for new records
    CASE WHEN p_entity_type = 'business' THEN 'page' ELSE p_entity_type END,
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
    -- For feed, business, page, or map page slugs, return 0 (we track in page_views table)
    v_view_count := 0;
  END IF;
  
  RETURN COALESCE(v_view_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




