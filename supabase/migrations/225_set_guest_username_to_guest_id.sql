-- Set unique username for guest accounts on creation
-- Username format: guest-XXXXXXXX (14 chars, using first 8 chars of UUID portion)
-- This meets the constraint: 3-30 chars, alphanumeric/hyphens/underscores only

-- ============================================================================
-- STEP 1: Drop existing function to update it
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_or_create_guest_account(TEXT, TEXT);

-- ============================================================================
-- STEP 2: Create helper function to generate guest username from guest_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_guest_username(p_guest_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_uuid_part TEXT;
  v_username TEXT;
  v_counter INT := 0;
BEGIN
  -- Extract UUID portion from guest_id (after 'guest_' prefix)
  -- guest_id format: guest_865d53a8-6a0e-4a2d-a82c-b1d1fc1de2ba
  v_uuid_part := substring(p_guest_id from 7 for 8); -- Gets '865d53a8'
  
  -- Base username: guest-XXXXXXXX
  v_username := 'guest-' || v_uuid_part;
  
  -- Check if username already exists, append counter if needed
  WHILE EXISTS (SELECT 1 FROM public.accounts WHERE username = v_username) LOOP
    v_counter := v_counter + 1;
    v_username := 'guest-' || v_uuid_part || '-' || v_counter;
    
    -- Safety check to prevent infinite loop
    IF v_counter > 100 THEN
      -- Fallback: use more of the UUID
      v_username := 'guest-' || substring(p_guest_id from 7 for 12);
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_username;
END;
$$;

-- ============================================================================
-- STEP 3: Create updated get_or_create_guest_account function
-- Now sets username on creation using the helper function
-- ============================================================================

CREATE FUNCTION public.get_or_create_guest_account(
  p_guest_id TEXT,
  p_first_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_guest_image_url TEXT := 'https://hfklpjuiuhbulztsqapv.supabase.co/storage/v1/object/public/logos/Guest%20Image.png';
  v_account JSON;
  v_username TEXT;
BEGIN
  -- Try to find existing guest account
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE guest_id = p_guest_id
  AND user_id IS NULL
  LIMIT 1;

  -- If found, update first_name if provided and different
  IF v_account_id IS NOT NULL THEN
    IF p_first_name IS NOT NULL AND p_first_name != '' THEN
      UPDATE public.accounts
      SET first_name = p_first_name,
          updated_at = NOW()
      WHERE id = v_account_id;
    END IF;
    
    -- Ensure image_url is set for existing guest accounts
    UPDATE public.accounts
    SET image_url = COALESCE(image_url, v_guest_image_url)
    WHERE id = v_account_id
    AND image_url IS NULL;
    
    -- Ensure username is set for existing guest accounts (backfill)
    UPDATE public.accounts
    SET username = generate_guest_username(p_guest_id)
    WHERE id = v_account_id
    AND username IS NULL;
  ELSE
    -- Generate unique username for new guest
    v_username := generate_guest_username(p_guest_id);
    
    -- Create new guest account with username
    INSERT INTO public.accounts (guest_id, first_name, username, role, image_url)
    VALUES (p_guest_id, p_first_name, v_username, 'general'::public.account_role, v_guest_image_url)
    RETURNING id INTO v_account_id;
  END IF;

  -- Return account details as JSON
  SELECT json_build_object(
    'id', id,
    'guest_id', guest_id,
    'first_name', first_name,
    'username', username,
    'image_url', COALESCE(image_url, v_guest_image_url)
  ) INTO v_account
  FROM public.accounts
  WHERE id = v_account_id;

  RETURN v_account;
END;
$$;

-- ============================================================================
-- STEP 4: Backfill existing guest accounts with usernames
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, guest_id 
    FROM public.accounts 
    WHERE user_id IS NULL 
    AND guest_id IS NOT NULL 
    AND username IS NULL
  LOOP
    UPDATE public.accounts
    SET username = generate_guest_username(r.guest_id)
    WHERE id = r.id;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_or_create_guest_account(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_guest_username(TEXT) TO anon, authenticated;

ALTER FUNCTION public.get_or_create_guest_account(TEXT, TEXT) OWNER TO postgres;

COMMENT ON FUNCTION public.get_or_create_guest_account IS
  'Gets or creates a guest account for anonymous users. Sets unique username (guest-XXXXXXXX format) for profile URLs. Returns account details as JSON (bypasses RLS via SECURITY DEFINER).';

COMMENT ON FUNCTION public.generate_guest_username IS
  'Generates a unique username for guest accounts in format guest-XXXXXXXX using first 8 chars of UUID.';

