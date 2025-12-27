-- Guest account management functions
-- Provides guests with ability to:
-- 1. Delete all their pins
-- 2. Delete their account (and all pins)
-- 3. Reset their account (delete pins, keep account)

-- ============================================================================
-- FUNCTION: Delete all pins for a guest account
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_all_guest_pins(p_guest_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_pins_deleted INTEGER := 0;
  v_request_guest_id TEXT;
BEGIN
  -- Get guest_id from request header for verification
  v_request_guest_id := public.get_request_guest_id();
  
  -- Verify the request guest_id matches the parameter
  IF v_request_guest_id IS NULL OR v_request_guest_id != p_guest_id THEN
    RAISE EXCEPTION 'Unauthorized: guest_id mismatch or missing x-guest-id header';
  END IF;

  -- Get the account_id for this guest
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE guest_id = p_guest_id
    AND user_id IS NULL;

  IF v_account_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Guest account not found',
      'pins_deleted', 0
    );
  END IF;

  -- Delete all pins for this account
  DELETE FROM public.pins
  WHERE account_id = v_account_id;

  GET DIAGNOSTICS v_pins_deleted = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'pins_deleted', v_pins_deleted,
    'account_id', v_account_id
  );
END;
$$;

ALTER FUNCTION public.delete_all_guest_pins(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.delete_all_guest_pins(TEXT) TO anon;

COMMENT ON FUNCTION public.delete_all_guest_pins IS
  'Deletes all pins for a guest account. Verifies ownership via x-guest-id header. Account is preserved.';

-- ============================================================================
-- FUNCTION: Delete guest account and all associated data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_guest_account(p_guest_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_pins_deleted INTEGER := 0;
  v_request_guest_id TEXT;
BEGIN
  -- Get guest_id from request header for verification
  v_request_guest_id := public.get_request_guest_id();
  
  -- Verify the request guest_id matches the parameter
  IF v_request_guest_id IS NULL OR v_request_guest_id != p_guest_id THEN
    RAISE EXCEPTION 'Unauthorized: guest_id mismatch or missing x-guest-id header';
  END IF;

  -- Get the account_id for this guest
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE guest_id = p_guest_id
    AND user_id IS NULL;

  IF v_account_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Guest account not found',
      'pins_deleted', 0,
      'account_deleted', false
    );
  END IF;

  -- Delete all pins for this account first
  DELETE FROM public.pins
  WHERE account_id = v_account_id;

  GET DIAGNOSTICS v_pins_deleted = ROW_COUNT;

  -- Delete the account
  DELETE FROM public.accounts
  WHERE id = v_account_id;

  RETURN json_build_object(
    'success', true,
    'pins_deleted', v_pins_deleted,
    'account_deleted', true,
    'account_id', v_account_id
  );
END;
$$;

ALTER FUNCTION public.delete_guest_account(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.delete_guest_account(TEXT) TO anon;

COMMENT ON FUNCTION public.delete_guest_account IS
  'Deletes a guest account and all associated pins. Verifies ownership via x-guest-id header. This is permanent and cannot be undone.';

-- ============================================================================
-- FUNCTION: Reset guest account (delete pins, keep account, optionally reset name)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_guest_account(
  p_guest_id TEXT,
  p_new_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_pins_deleted INTEGER := 0;
  v_request_guest_id TEXT;
BEGIN
  -- Get guest_id from request header for verification
  v_request_guest_id := public.get_request_guest_id();
  
  -- Verify the request guest_id matches the parameter
  IF v_request_guest_id IS NULL OR v_request_guest_id != p_guest_id THEN
    RAISE EXCEPTION 'Unauthorized: guest_id mismatch or missing x-guest-id header';
  END IF;

  -- Get the account_id for this guest
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE guest_id = p_guest_id
    AND user_id IS NULL;

  IF v_account_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Guest account not found',
      'pins_deleted', 0
    );
  END IF;

  -- Delete all pins for this account
  DELETE FROM public.pins
  WHERE account_id = v_account_id;

  GET DIAGNOSTICS v_pins_deleted = ROW_COUNT;

  -- Optionally update the name
  IF p_new_name IS NOT NULL THEN
    UPDATE public.accounts
    SET first_name = p_new_name,
        updated_at = NOW()
    WHERE id = v_account_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'pins_deleted', v_pins_deleted,
    'account_id', v_account_id,
    'name_updated', p_new_name IS NOT NULL
  );
END;
$$;

ALTER FUNCTION public.reset_guest_account(TEXT, TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.reset_guest_account(TEXT, TEXT) TO anon;

COMMENT ON FUNCTION public.reset_guest_account IS
  'Resets a guest account by deleting all pins but keeping the account. Optionally updates the display name. Same guest_id is preserved.';





