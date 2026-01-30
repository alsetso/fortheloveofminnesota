-- Profile view_count: count visits to /:username as well as /profile/:username
-- App uses canonical profile URL /:username (e.g. /johndoe); record_url_visit previously
-- only incremented accounts.view_count for /profile/% so profile Views were never updated.

-- ============================================================================
-- STEP 1: Update record_url_visit to treat single-segment path as profile URL
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
  v_trimmed_url TEXT;
BEGIN
  v_trimmed_url := TRIM(p_url);

  -- Validate URL
  IF p_url IS NULL OR LENGTH(v_trimmed_url) = 0 THEN
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
    v_trimmed_url,
    p_account_id,
    p_user_agent,
    p_referrer_url,
    p_session_id,
    NOW()
  )
  RETURNING id INTO v_visit_id;

  -- Profile page view: increment account view_count
  -- 1) Canonical profile URL: /:username (e.g. /johndoe)
  IF v_trimmed_url ~ '^/[^/?#]+$' THEN
    v_profile_username := TRIM(SUBSTRING(v_trimmed_url FROM 2));
    IF v_profile_username IS NOT NULL AND LENGTH(v_profile_username) > 0 THEN
      SELECT id INTO v_profile_account_id
      FROM public.accounts
      WHERE LOWER(TRIM(username)) = LOWER(v_profile_username)
      LIMIT 1;
      IF v_profile_account_id IS NOT NULL THEN
        IF p_account_id IS NULL OR v_profile_account_id != p_account_id THEN
          UPDATE public.accounts
          SET view_count = COALESCE(view_count, 0) + 1
          WHERE id = v_profile_account_id;
        END IF;
      END IF;
    END IF;
  -- 2) Legacy /profile/:username
  ELSIF v_trimmed_url LIKE '/profile/%' THEN
    v_profile_username := public.extract_profile_username_from_url(v_trimmed_url);
    IF v_profile_username IS NOT NULL AND LENGTH(v_profile_username) > 0 THEN
      SELECT id INTO v_profile_account_id
      FROM public.accounts
      WHERE LOWER(TRIM(username)) = LOWER(v_profile_username)
      LIMIT 1;
      IF v_profile_account_id IS NOT NULL THEN
        IF p_account_id IS NULL OR v_profile_account_id != p_account_id THEN
          UPDATE public.accounts
          SET view_count = COALESCE(view_count, 0) + 1
          WHERE id = v_profile_account_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Pin/mention view: increment map_pins.view_count
  v_pin_id := public.extract_mention_id_from_url(v_trimmed_url);
  IF v_pin_id IS NOT NULL THEN
    UPDATE public.map_pins
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = v_pin_id
      AND is_active = true
      AND archived = false;
  END IF;

  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.record_url_visit IS 'Records URL visits and updates view counts. Profile: /:username or /profile/:username increments accounts.view_count (excluding self-visits). Pin/mention URLs increment map_pins.view_count.';
