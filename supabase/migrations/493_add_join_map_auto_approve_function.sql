-- Add RPC function for auto-approving map membership
-- This function handles the insert with proper security checks
-- Uses SECURITY DEFINER to bypass RLS while still validating permissions

CREATE OR REPLACE FUNCTION public.join_map_auto_approve(
  p_map_id UUID,
  p_account_id UUID
)
RETURNS TABLE (
  id UUID,
  map_id UUID,
  account_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map_record RECORD;
  v_user_id UUID;
BEGIN
  -- Get current user_id from auth context
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Verify account belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = p_account_id
    AND accounts.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Account does not belong to user';
  END IF;
  
  -- Get map details
  SELECT m.id, m.visibility, m.is_active, m.auto_approve_members
  INTO v_map_record
  FROM public.map m
  WHERE m.id = p_map_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Map not found';
  END IF;
  
  -- Verify auto-approve conditions
  IF v_map_record.visibility != 'public' THEN
    RAISE EXCEPTION 'Map is not public';
  END IF;
  
  IF NOT v_map_record.is_active THEN
    RAISE EXCEPTION 'Map is not active';
  END IF;
  
  IF NOT v_map_record.auto_approve_members THEN
    RAISE EXCEPTION 'Map does not auto-approve members';
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.map_members
    WHERE map_members.map_id = p_map_id
    AND map_members.account_id = p_account_id
  ) THEN
    RAISE EXCEPTION 'Already a member';
  END IF;
  
  -- Insert member
  INSERT INTO public.map_members (map_id, account_id, role)
  VALUES (p_map_id, p_account_id, 'editor');
  
  -- Return the inserted member
  RETURN QUERY
  SELECT 
    mm.id,
    mm.map_id,
    mm.account_id,
    mm.role,
    mm.joined_at
  FROM public.map_members mm
  WHERE mm.map_id = p_map_id
    AND mm.account_id = p_account_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.join_map_auto_approve(UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.join_map_auto_approve(UUID, UUID) IS 'Auto-approve map membership for public maps with auto_approve_members enabled. Validates all conditions before inserting.';
