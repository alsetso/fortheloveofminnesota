-- Update join_map_auto_approve function to check member limits
-- Checks both owner's max_members setting and plan's map_members limit

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
  v_map_owner_account_id UUID;
  v_current_member_count INTEGER;
  v_owner_setting INTEGER;
  v_plan_limit RECORD;
  v_effective_limit INTEGER;
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
  
  -- Get map details including settings and owner
  SELECT 
    m.id, 
    m.visibility, 
    m.is_active, 
    m.auto_approve_members,
    m.account_id,
    m.settings,
    m.member_count
  INTO v_map_record
  FROM public.map m
  WHERE m.id = p_map_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Map not found';
  END IF;
  
  v_map_owner_account_id := v_map_record.account_id;
  v_current_member_count := v_map_record.member_count;
  
  -- Extract owner's max_members setting from settings JSONB
  v_owner_setting := (v_map_record.settings->'membership'->>'max_members')::INTEGER;
  
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
  
  -- Check member limit
  -- Get plan limit for map owner using billing function
  SELECT 
    limit_value,
    limit_type,
    is_unlimited
  INTO v_plan_limit
  FROM billing.get_account_feature_limit(v_map_owner_account_id, 'map_members')
  LIMIT 1;
  
  -- Calculate effective limit
  IF NOT FOUND THEN
    -- Feature not found for this account - treat as no plan limit, use owner setting only
    v_effective_limit := v_owner_setting;
  ELSIF v_plan_limit.is_unlimited OR (v_plan_limit.limit_type = 'unlimited' OR v_plan_limit.limit_value IS NULL) THEN
    -- Plan allows unlimited, so owner setting is the only constraint
    v_effective_limit := v_owner_setting;
  ELSIF v_plan_limit.limit_type = 'count' AND v_plan_limit.limit_value IS NOT NULL THEN
    -- Plan has a count limit
    IF v_owner_setting IS NOT NULL THEN
      -- Owner set a limit - use the minimum of owner setting and plan limit
      v_effective_limit := LEAST(v_owner_setting, v_plan_limit.limit_value);
    ELSE
      -- Owner didn't set a limit - use plan limit
      v_effective_limit := v_plan_limit.limit_value;
    END IF;
  ELSE
    -- Plan doesn't have the feature or has no limit
    v_effective_limit := v_owner_setting;
  END IF;
  
  -- Check if limit is reached
  IF v_effective_limit IS NOT NULL AND v_current_member_count >= v_effective_limit THEN
    RAISE EXCEPTION 'Map has reached the maximum member limit of %', v_effective_limit;
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

-- Update comment
COMMENT ON FUNCTION public.join_map_auto_approve(UUID, UUID) IS 'Auto-approve map membership for public maps with auto_approve_members enabled. Validates all conditions including member limits before inserting.';
