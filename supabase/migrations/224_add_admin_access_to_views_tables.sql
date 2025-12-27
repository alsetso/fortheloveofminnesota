-- Add admin access to page_views and pin_views tables
-- Allows admins to view all views data

-- ============================================================================
-- STEP 1: Add admin SELECT policies for page_views
-- ============================================================================

CREATE POLICY "Admins can view all page views"
  ON public.page_views FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 2: Add admin SELECT policies for pin_views
-- ============================================================================

CREATE POLICY "Admins can view all pin views"
  ON public.pin_views FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================

COMMENT ON POLICY "Admins can view all page views" ON public.page_views IS
  'Allows users with admin role to view all page views for analytics and administration.';

COMMENT ON POLICY "Admins can view all pin views" ON public.pin_views IS
  'Allows users with admin role to view all pin views for analytics and administration.';






