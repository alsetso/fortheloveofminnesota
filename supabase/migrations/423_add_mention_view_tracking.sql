-- Add mention view tracking to analytics.record_page_view
-- Detects /mention/{id} URLs and increments mentions.view_count

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
  v_mention_id UUID;
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
        SPLIT_PART(
          REGEXP_REPLACE(p_page_url, '^/profile/', ''),
          '?',
          1
        ),
        '/',
        1
      )
    );
    
    -- Find account by username and increment view_count
    IF v_profile_username IS NOT NULL AND LENGTH(v_profile_username) > 0 THEN
      UPDATE public.accounts
      SET view_count = COALESCE(view_count, 0) + 1
      WHERE username = v_profile_username
      RETURNING id INTO v_profile_account_id;
      
      -- Log for debugging (optional)
      IF v_profile_account_id IS NOT NULL THEN
        RAISE DEBUG 'Incremented view_count for profile: % (account_id: %)', v_profile_username, v_profile_account_id;
      END IF;
    END IF;
  END IF;
  
  -- Check if this is a mention page view and increment mentions.view_count
  -- Mention pages follow the pattern: /mention/{id}
  IF p_page_url LIKE '/mention/%' THEN
    -- Extract mention ID from URL
    BEGIN
      v_mention_id := TRIM(
        SPLIT_PART(
          SPLIT_PART(
            REGEXP_REPLACE(p_page_url, '^/mention/', ''),
            '?',
            1
          ),
          '/',
          1
        )
      )::UUID;
      
      -- Increment view_count for the mention
      UPDATE public.mentions
      SET view_count = COALESCE(view_count, 0) + 1
      WHERE id = v_mention_id;
      
      -- Log for debugging (optional)
      IF FOUND THEN
        RAISE DEBUG 'Incremented view_count for mention: %', v_mention_id;
      END IF;
    EXCEPTION
      WHEN invalid_text_representation THEN
        -- Invalid UUID in URL, silently ignore
        RAISE DEBUG 'Invalid mention ID in URL: %', p_page_url;
    END;
  END IF;
  
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION analytics.record_page_view TO authenticated, anon;
