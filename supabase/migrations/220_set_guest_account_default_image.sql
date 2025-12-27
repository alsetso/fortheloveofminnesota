-- Set default guest image for all guest accounts
-- Updates the get_or_create_guest_account function to set image_url

-- ============================================================================
-- STEP 1: Drop existing function to change return type
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_or_create_guest_account(TEXT, TEXT);

-- ============================================================================
-- STEP 2: Create get_or_create_guest_account function with JSON return type
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
  v_guest_image_url TEXT := 'https://hfklpjuiuhbulztsqapv.supabase.co/storage/v1/object/public/logos/Guest%20Image.png'; -- Default guest image URL
  v_account JSON;
BEGIN
  -- Try to find existing guest account
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE guest_id = p_guest_id
  AND user_id IS NULL
  LIMIT 1;

  -- If found, update first_name if provided and different
  -- Also ensure image_url is set if it's null
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
  ELSE
    -- Create new guest account with default image
    INSERT INTO public.accounts (guest_id, first_name, role, image_url)
    VALUES (p_guest_id, p_first_name, 'general'::public.account_role, v_guest_image_url)
    RETURNING id INTO v_account_id;
  END IF;

  -- Return account details as JSON (bypasses RLS since we're SECURITY DEFINER)
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
-- STEP 3: Update existing guest accounts to have default image
-- ============================================================================

UPDATE public.accounts
SET image_url = 'https://hfklpjuiuhbulztsqapv.supabase.co/storage/v1/object/public/logos/Guest%20Image.png'
WHERE user_id IS NULL
AND guest_id IS NOT NULL
AND image_url IS NULL;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_or_create_guest_account(TEXT, TEXT) TO anon, authenticated;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.get_or_create_guest_account(TEXT, TEXT) OWNER TO postgres;

COMMENT ON FUNCTION public.get_or_create_guest_account IS
  'Gets or creates a guest account for anonymous users. Guest accounts have NULL user_id and are identified by guest_id (stored in local storage). Sets default guest image from Supabase storage. Returns account details as JSON (bypasses RLS via SECURITY DEFINER).';








