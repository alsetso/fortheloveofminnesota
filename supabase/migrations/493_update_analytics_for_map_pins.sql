-- Update analytics functions to use map_pins instead of mentions
-- This ensures view tracking works for the unified map_pins table

-- ============================================================================
-- STEP 1: Update record_url_visit to increment map_pins.view_count
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
  v_pin_id UUID;
BEGIN
  -- Validate URL
  IF p_url IS NULL OR LENGTH(TRIM(p_url)) = 0 THEN
    RAISE EXCEPTION 'url cannot be empty';
  END IF;
  
  -- Insert URL visit record
  INSERT INTO public.url_visits (
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
  
  -- Check if this is a profile page view and increment account view_count
  IF TRIM(p_url) LIKE '/profile/%' THEN
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
  
  -- Check if this is a pin/mention view and increment map_pins.view_count
  -- extract_mention_id_from_url works for both mentions and map_pins (same URL pattern)
  v_pin_id := public.extract_mention_id_from_url(TRIM(p_url));
  
  IF v_pin_id IS NOT NULL THEN
    -- Increment view_count for the map_pin (works for both mentions and custom map pins)
    UPDATE public.map_pins
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = v_pin_id
    AND is_active = true
    AND archived = false;
  END IF;
  
  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Add comment
-- ============================================================================

COMMENT ON FUNCTION public.record_url_visit IS 'Records URL visits and automatically updates view counts. For pins/mentions, increments map_pins.view_count (unified table).';
