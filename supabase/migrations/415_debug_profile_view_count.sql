-- Debug and fix profile view count increment
-- Adds logging and fixes potential issues with username extraction

-- ============================================================================
-- STEP 1: Update analytics.record_page_view with better debugging and fixes
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
  v_trimmed_url TEXT;
BEGIN
  -- Validate page_url
  IF p_page_url IS NULL OR LENGTH(TRIM(p_page_url)) = 0 THEN
    RAISE EXCEPTION 'page_url cannot be empty';
  END IF;
  
  v_trimmed_url := TRIM(p_page_url);
  
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
    v_trimmed_url,
    p_account_id,
    p_user_agent,
    p_referrer_url,
    p_session_id,
    NOW()
  )
  RETURNING id INTO v_view_id;
  
  -- Check if this is a profile page view and increment account view_count
  -- Profile pages follow the pattern: /profile/{username}
  IF v_trimmed_url LIKE '/profile/%' THEN
    -- Extract username from URL
    -- Remove leading /profile/ and take everything up to the next /, ?, or end
    v_profile_username := TRIM(
      SPLIT_PART(
        REPLACE(v_trimmed_url, '/profile/', ''),
        '/',
        1
      )
    );
    
    -- Remove query parameters if present
    IF POSITION('?' IN v_profile_username) > 0 THEN
      v_profile_username := SPLIT_PART(v_profile_username, '?', 1);
    END IF;
    
    -- Remove hash fragments if present
    IF POSITION('#' IN v_profile_username) > 0 THEN
      v_profile_username := SPLIT_PART(v_profile_username, '#', 1);
    END IF;
    
    -- Trim whitespace
    v_profile_username := TRIM(v_profile_username);
    
    -- Only proceed if we extracted a username
    IF v_profile_username IS NOT NULL AND LENGTH(v_profile_username) > 0 THEN
      -- Look up the account by username (case-insensitive)
      SELECT id INTO v_profile_account_id
      FROM public.accounts
      WHERE LOWER(TRIM(username)) = LOWER(v_profile_username)
      LIMIT 1;
      
      -- If account found and it's not a self-visit, increment view_count
      IF v_profile_account_id IS NOT NULL THEN
        -- Check if it's a self-visit (only if both account_ids are not null)
        IF p_account_id IS NULL OR v_profile_account_id != p_account_id THEN
          UPDATE public.accounts
          SET view_count = COALESCE(view_count, 0) + 1
          WHERE id = v_profile_account_id;
          
          -- Log for debugging (remove in production if needed)
          -- RAISE NOTICE 'Incremented view_count for account % (username: %)', v_profile_account_id, v_profile_username;
        END IF;
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
  'Records a page view and increments account view_count for profile page visits. Does not increment for self-visits. Uses case-insensitive username matching.';
