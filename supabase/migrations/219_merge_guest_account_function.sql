-- Function to merge guest account into authenticated account
-- Transfers all pins from guest account to authenticated account
-- Optionally preserves guest account or deletes it

CREATE OR REPLACE FUNCTION public.merge_guest_account_into_user(
  p_guest_account_id UUID,
  p_user_account_id UUID,
  p_delete_guest_account BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pins_transferred INTEGER := 0;
  v_result JSON;
BEGIN
  -- Verify that guest_account_id is actually a guest account (user_id IS NULL)
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_guest_account_id
    AND user_id IS NULL
    AND guest_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Account % is not a guest account', p_guest_account_id;
  END IF;

  -- Verify that user_account_id belongs to the authenticated user
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_user_account_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Account % does not belong to authenticated user', p_user_account_id;
  END IF;

  -- Transfer all pins from guest account to user account
  UPDATE public.pins
  SET account_id = p_user_account_id,
      updated_at = NOW()
  WHERE account_id = p_guest_account_id;

  GET DIAGNOSTICS v_pins_transferred = ROW_COUNT;

  -- Optionally delete the guest account
  IF p_delete_guest_account THEN
    DELETE FROM public.accounts
    WHERE id = p_guest_account_id;
  END IF;

  -- Return result
  v_result := json_build_object(
    'success', true,
    'pins_transferred', v_pins_transferred,
    'guest_account_deleted', p_delete_guest_account
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION public.merge_guest_account_into_user(UUID, UUID, BOOLEAN) TO authenticated;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.merge_guest_account_into_user(UUID, UUID, BOOLEAN) OWNER TO postgres;

COMMENT ON FUNCTION public.merge_guest_account_into_user IS
  'Merges a guest account into an authenticated user account. Transfers all pins from guest account to user account. Optionally deletes the guest account. Only the authenticated user can merge their own accounts.';


