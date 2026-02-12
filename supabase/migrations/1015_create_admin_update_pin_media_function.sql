-- Create admin function to update pin media URLs in maps.pins
-- Admin-only function for media migration

CREATE OR REPLACE FUNCTION admin.update_pin_media(
  p_pin_id UUID,
  p_image_url TEXT DEFAULT NULL,
  p_video_url TEXT DEFAULT NULL,
  p_icon_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updates TEXT := '';
BEGIN
  -- Allow service role (auth.uid() is NULL for service role) or check admin status
  -- Service role bypasses RLS and is used for admin operations
  -- The API route is already protected by withSecurity middleware
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Validate pin_id is UUID
  IF p_pin_id IS NULL THEN
    RAISE EXCEPTION 'Pin ID is required';
  END IF;

  -- Build update statement dynamically
  IF p_image_url IS NOT NULL THEN
    v_updates := v_updates || format('image_url = %L', p_image_url);
  END IF;

  IF p_video_url IS NOT NULL THEN
    IF v_updates != '' THEN
      v_updates := v_updates || ', ';
    END IF;
    v_updates := v_updates || format('video_url = %L', p_video_url);
  END IF;

  IF p_icon_url IS NOT NULL THEN
    IF v_updates != '' THEN
      v_updates := v_updates || ', ';
    END IF;
    v_updates := v_updates || format('icon_url = %L', p_icon_url);
  END IF;

  -- Only update if there are changes
  IF v_updates != '' THEN
    EXECUTE format('UPDATE maps.pins SET %s WHERE id = %L', v_updates, p_pin_id);
  END IF;
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION admin.update_pin_media(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Create public wrapper for easier RPC access
CREATE OR REPLACE FUNCTION public.update_pin_media(
  p_pin_id UUID,
  p_image_url TEXT DEFAULT NULL,
  p_video_url TEXT DEFAULT NULL,
  p_icon_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow service role (for admin API routes) or check admin status
  IF current_setting('role', true) != 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Call the admin schema function
  PERFORM admin.update_pin_media(p_pin_id, p_image_url, p_video_url, p_icon_url);
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.update_pin_media(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.update_pin_media(UUID, TEXT, TEXT, TEXT) IS 
  'Admin-only function to update pin media URLs in maps.pins table. Used for media migration.';
