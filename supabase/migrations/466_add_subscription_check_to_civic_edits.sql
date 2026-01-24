-- Add subscription requirement check to civic edit functions
-- Users must have Contributor, Professional, or Business plan with active subscription to edit gov data

-- ============================================================================
-- STEP 1: Update update_civic_field_with_logging to check subscription
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_civic_field_with_logging(
  p_table_name TEXT,
  p_record_id UUID,
  p_field_name TEXT,
  p_new_value TEXT,
  p_account_id UUID,
  p_old_value TEXT,
  p_edit_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, civic
AS $$
DECLARE
  v_event_id UUID;
  v_update_sql TEXT;
  v_affected_rows INT;
  v_account_plan TEXT;
  v_subscription_status TEXT;
  v_account_role TEXT;
  v_has_access BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_table_name NOT IN ('orgs', 'people', 'roles') THEN
    RAISE EXCEPTION 'Invalid table_name: %', p_table_name;
  END IF;
  
  -- Validate account_id matches authenticated user
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts 
    WHERE id = p_account_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Account ID does not match authenticated user';
  END IF;

  -- Check subscription access (Contributor, Professional, or Business plan with active subscription)
  SELECT plan, subscription_status, role
  INTO v_account_plan, v_subscription_status, v_account_role
  FROM public.accounts
  WHERE id = p_account_id;

  -- Check if user has Contributor, Professional, or Business plan
  v_has_access := (
    v_account_plan IN ('contributor', 'professional', 'business', 'plus') AND
    (v_subscription_status = 'active' OR v_subscription_status = 'trialing')
  );

  -- Allow admins to edit regardless of subscription
  IF NOT v_has_access THEN
    v_has_access := (v_account_role = 'admin');
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Editing government data requires a Contributor, Professional, or Business subscription with an active subscription. Upgrade to contribute.';
  END IF;
  
  -- Update the record
  v_update_sql := format(
    'UPDATE civic.%I SET %I = $1 WHERE id = $2',
    p_table_name,
    p_field_name
  );
  
  EXECUTE v_update_sql USING p_new_value, p_record_id;
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  
  IF v_affected_rows = 0 THEN
    RAISE EXCEPTION 'Record not found or update failed';
  END IF;
  
  -- Log the event (in same transaction)
  v_event_id := public.log_civic_event(
    p_table_name,
    p_record_id,
    p_field_name,
    p_account_id,
    p_old_value,
    p_new_value,
    p_edit_reason
  );
  
  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.update_civic_field_with_logging IS 
  'Atomic update and logging function with subscription check. Updates field and logs event in single transaction. Requires Contributor, Professional, or Business plan with active subscription (or admin role).';

-- ============================================================================
-- STEP 2: Update log_civic_event to also check subscription (for direct calls)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_civic_event(
  p_table_name TEXT,
  p_record_id UUID,
  p_field_name TEXT,
  p_account_id UUID,
  p_old_value TEXT,
  p_new_value TEXT,
  p_edit_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, civic
AS $$
DECLARE
  v_event_id UUID;
  v_user_account_id UUID;
  v_record_exists BOOLEAN;
  v_account_plan TEXT;
  v_subscription_status TEXT;
  v_account_role TEXT;
  v_has_access BOOLEAN;
BEGIN
  -- Validate account_id matches authenticated user
  SELECT id INTO v_user_account_id
  FROM public.accounts
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_user_account_id IS NULL OR v_user_account_id != p_account_id THEN
    RAISE EXCEPTION 'Account ID does not match authenticated user';
  END IF;

  -- Check subscription access (Contributor, Professional, or Business plan with active subscription)
  SELECT plan, subscription_status, role
  INTO v_account_plan, v_subscription_status, v_account_role
  FROM public.accounts
  WHERE id = p_account_id;

  -- Check if user has Contributor, Professional, or Business plan
  v_has_access := (
    v_account_plan IN ('contributor', 'professional', 'business', 'plus') AND
    (v_subscription_status = 'active' OR v_subscription_status = 'trialing')
  );

  -- Allow admins to edit regardless of subscription
  IF NOT v_has_access THEN
    v_has_access := (v_account_role = 'admin');
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Editing government data requires a Contributor, Professional, or Business subscription with an active subscription. Upgrade to contribute.';
  END IF;
  
  -- Validate table_name
  IF p_table_name NOT IN ('orgs', 'people', 'roles') THEN
    RAISE EXCEPTION 'Invalid table_name: %', p_table_name;
  END IF;
  
  -- Validate record exists in the specified table
  IF p_table_name = 'orgs' THEN
    SELECT EXISTS(SELECT 1 FROM civic.orgs WHERE id = p_record_id) INTO v_record_exists;
  ELSIF p_table_name = 'people' THEN
    SELECT EXISTS(SELECT 1 FROM civic.people WHERE id = p_record_id) INTO v_record_exists;
  ELSIF p_table_name = 'roles' THEN
    SELECT EXISTS(SELECT 1 FROM civic.roles WHERE id = p_record_id) INTO v_record_exists;
  END IF;
  
  IF NOT v_record_exists THEN
    RAISE EXCEPTION 'Record does not exist in table %', p_table_name;
  END IF;
  
  -- Insert event
  INSERT INTO civic.events (
    table_name,
    record_id,
    field_name,
    account_id,
    old_value,
    new_value,
    edit_reason
  ) VALUES (
    p_table_name,
    p_record_id,
    p_field_name,
    p_account_id,
    p_old_value,
    p_new_value,
    p_edit_reason
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.log_civic_event IS 
  'Validated logging function for civic edits with subscription check. Ensures account_id matches authenticated user, record exists, and user has Contributor/Professional/Business subscription (or admin role).';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
