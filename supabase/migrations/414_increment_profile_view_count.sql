-- Increment account view_count when profile pages are viewed
-- Updates analytics.record_page_view to detect profile page URLs and increment the profile owner's view_count

-- ============================================================================
-- STEP 1: Update analytics.record_page_view to increment profile view_count
-- ============================================================================

CREATE OR REPLACE FUNCTION analytics.record_page_view(
  p_page_url TEXT,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_view_id UUID;
  v_profile_username TEXT;
  v_profile_account_id UUID;
BEGIN
  -- Validate page_url
  IF p_page_url IS NULL OR LENGTH(TRIM(p_page_url)) = 0 THEN
    RAISE EXCEPTION 'page_url cannot be empty';
  END IF;
  
  -- Insert page view record
  INSERT INTO analytics.page_views (
    page_url,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    TRIM(p_page_url),
    p_account_id,
    p_user_agent,
    p_referrer_url,
    p_session_id,
    NOW()
  )
  RETURNING id INTO v_view_id;
  
  -- Check if this is a profile page view and increment account view_count
  -- Profile pages follow the pattern: /profile/{username}
  IF p_page_url LIKE '/profile/%' THEN
    -- Extract username from URL (everything after /profile/ up to next / or ? or end of string)
    -- Remove leading /profile/ and take everything up to the next /, ?, or end
    v_profile_username := TRIM(
      SPLIT_PART(
        REPLACE(TRIM(p_page_url), '/profile/', ''),
        '/',
        1
      )
    );
    
    -- Remove query parameters if present
    IF POSITION('?' IN v_profile_username) > 0 THEN
      v_profile_username := SPLIT_PART(v_profile_username, '?', 1);
    END IF;
    
    -- Only proceed if we extracted a username
    IF v_profile_username IS NOT NULL AND LENGTH(v_profile_username) > 0 THEN
      -- Look up the account by username
      SELECT id INTO v_profile_account_id
      FROM public.accounts
      WHERE username = v_profile_username
      LIMIT 1;
      
      -- If account found and it's not a self-visit, increment view_count
      IF v_profile_account_id IS NOT NULL AND v_profile_account_id != p_account_id THEN
        UPDATE public.accounts
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE id = v_profile_account_id;
      END IF;
    END IF;
  END IF;
  
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Add comment
-- ============================================================================

COMMENT ON FUNCTION analytics.record_page_view IS
  'Records a page view and increments account view_count for profile page visits. Does not increment for self-visits.';
