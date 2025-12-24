-- Enhance page_views table with additional tracking fields
-- Adds referrer, session_id, and time_on_page for better analytics

-- ============================================================================
-- STEP 1: Add new columns to page_views table
-- ============================================================================

ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS referrer_url TEXT,
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS time_on_page INTEGER; -- seconds

-- Add index for session_id queries
CREATE INDEX IF NOT EXISTS idx_page_views_session_id 
  ON public.page_views(session_id)
  WHERE session_id IS NOT NULL;

-- Add index for referrer analysis
CREATE INDEX IF NOT EXISTS idx_page_views_referrer 
  ON public.page_views(referrer_url)
  WHERE referrer_url IS NOT NULL;

-- ============================================================================
-- STEP 2: Update record_page_view function to accept new parameters
-- ============================================================================

-- Drop all existing overloads of record_page_view
-- This handles the case where multiple function signatures exist
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

-- Create the new function with enhanced parameters
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
  -- Validate entity_type
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'account', 'business', 'feed', 'map', 'map_pin', 'homepage', 'explore', 'cities_list', 'counties_list', 'contact') THEN
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

-- Add comment
COMMENT ON FUNCTION public.record_page_view IS
  'Records a page view with enhanced tracking data including referrer, session_id, and user_agent. Returns the updated view_count for entities with view_count columns, or 0 for page-level entities.';

-- ============================================================================
-- STEP 3: Update page_views constraint to include new entity types
-- ============================================================================

ALTER TABLE public.page_views
  DROP CONSTRAINT IF EXISTS page_views_entity_type_check;

ALTER TABLE public.page_views
  ADD CONSTRAINT page_views_entity_type_check 
  CHECK (entity_type IN ('post', 'article', 'city', 'county', 'account', 'business', 'page', 'feed', 'map', 'map_pin', 'homepage', 'explore', 'cities_list', 'counties_list', 'contact'));





