-- Update page_views RLS policy to support homepage and map_pin entity types
-- Allows users to view analytics for their own content including map pins

-- ============================================================================
-- STEP 1: Update page_views_select_own policy to include homepage and map_pin
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
    -- For map_pins, check ownership via account_id
    (entity_type = 'map_pin' AND EXISTS (
      SELECT 1 FROM public.map_pins WHERE id = page_views.entity_id AND account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
    )) OR
    -- For homepage, allow all authenticated users to see homepage stats (shared entity)
    (entity_type = 'homepage' AND auth.uid() IS NOT NULL)
  );

-- Add comment
COMMENT ON POLICY "page_views_select_own" ON public.page_views IS
  'Allows users to view page_views for their own content (accounts, posts, pages, map_pins) and homepage views (shared, all authenticated users can see).';





