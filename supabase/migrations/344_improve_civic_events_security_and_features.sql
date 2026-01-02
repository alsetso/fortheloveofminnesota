-- Improve civic.events system: security, validation, and edit reasons
-- Adds transaction safety, input validation, and optional edit_reason field

-- ============================================================================
-- STEP 1: Add edit_reason field to civic.events
-- ============================================================================

ALTER TABLE civic.events 
ADD COLUMN IF NOT EXISTS edit_reason TEXT;

COMMENT ON COLUMN civic.events.edit_reason IS 
  'Optional reason or comment explaining why this edit was made';

-- ============================================================================
-- STEP 2: Improve log_civic_event function with validation and transactions
-- ============================================================================

-- Drop the old function first to avoid signature conflicts
DROP FUNCTION IF EXISTS public.log_civic_event(TEXT, UUID, TEXT, UUID, TEXT, TEXT);

-- Create improved function with validation and edit_reason support
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
BEGIN
  -- Validate account_id matches authenticated user
  SELECT id INTO v_user_account_id
  FROM public.accounts
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_user_account_id IS NULL OR v_user_account_id != p_account_id THEN
    RAISE EXCEPTION 'Account ID does not match authenticated user';
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
  'Validated logging function for civic edits. Ensures account_id matches authenticated user and record exists.';

-- ============================================================================
-- STEP 3: Create function to update with transaction safety
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
  'Atomic update and logging function. Updates field and logs event in single transaction.';

GRANT EXECUTE ON FUNCTION public.update_civic_field_with_logging TO authenticated;

-- ============================================================================
-- STEP 4: Update public view to include edit_reason
-- ============================================================================

-- Drop the existing view first (needed because column structure changes)
DROP VIEW IF EXISTS public.civic_events;

-- Recreate view with edit_reason included (from e.*)
CREATE VIEW public.civic_events AS 
SELECT 
  e.*,
  a.username as account_username,
  a.first_name as account_first_name,
  a.last_name as account_last_name
FROM civic.events e
LEFT JOIN public.accounts a ON e.account_id = a.id;

-- Re-grant permissions
GRANT SELECT ON public.civic_events TO anon, authenticated;

-- ============================================================================
-- STEP 5: Add index for edit_reason queries (if needed in future)
-- ============================================================================

-- No index needed for now, edit_reason is optional and rarely queried

