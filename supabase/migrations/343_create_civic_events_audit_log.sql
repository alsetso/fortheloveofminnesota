-- Create civic.events table for wiki-style edit tracking
-- Tracks all changes to editable fields in orgs, people, and roles tables
-- Never loses data - full history of all edits

-- ============================================================================
-- STEP 1: Create civic.events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS civic.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was edited
  table_name TEXT NOT NULL CHECK (table_name IN ('orgs', 'people', 'roles')),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  
  -- Who made the edit
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  
  -- What changed (stored as TEXT for simplicity, can be JSONB if needed)
  old_value TEXT,
  new_value TEXT,
  
  -- When
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for efficient queries
-- ============================================================================

CREATE INDEX idx_civic_events_table_record ON civic.events(table_name, record_id);
CREATE INDEX idx_civic_events_account_id ON civic.events(account_id);
CREATE INDEX idx_civic_events_created_at ON civic.events(created_at DESC);
CREATE INDEX idx_civic_events_table_field ON civic.events(table_name, field_name);

-- ============================================================================
-- STEP 3: Create function to log events
-- ============================================================================

CREATE OR REPLACE FUNCTION civic.log_event(
  p_table_name TEXT,
  p_record_id UUID,
  p_field_name TEXT,
  p_account_id UUID,
  p_old_value TEXT,
  p_new_value TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO civic.events (
    table_name,
    record_id,
    field_name,
    account_id,
    old_value,
    new_value
  ) VALUES (
    p_table_name,
    p_record_id,
    p_field_name,
    p_account_id,
    p_old_value,
    p_new_value
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION civic.log_event IS 
  'Logs a change event to civic.events table. Used for wiki-style edit tracking.';

-- Create public wrapper function for Supabase RPC access
CREATE OR REPLACE FUNCTION public.log_civic_event(
  p_table_name TEXT,
  p_record_id UUID,
  p_field_name TEXT,
  p_account_id UUID,
  p_old_value TEXT,
  p_new_value TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, civic
AS $$
BEGIN
  RETURN civic.log_event(
    p_table_name,
    p_record_id,
    p_field_name,
    p_account_id,
    p_old_value,
    p_new_value
  );
END;
$$;

COMMENT ON FUNCTION public.log_civic_event IS 
  'Public wrapper for civic.log_event. Use this function from Supabase RPC.';

GRANT EXECUTE ON FUNCTION public.log_civic_event TO authenticated;

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE civic.events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies for events
-- ============================================================================

-- Anyone can view events (public edit history)
CREATE POLICY "Anyone can view events"
  ON civic.events FOR SELECT TO authenticated, anon USING (true);

-- Only authenticated users can insert events (via function)
CREATE POLICY "Authenticated users can insert events"
  ON civic.events FOR INSERT TO authenticated
  WITH CHECK (account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1));

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON civic.events TO anon, authenticated;
GRANT INSERT ON civic.events TO authenticated;

-- ============================================================================
-- STEP 7: Create public view for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.civic_events AS 
SELECT 
  e.*,
  a.username as account_username,
  a.first_name as account_first_name,
  a.last_name as account_last_name
FROM civic.events e
LEFT JOIN public.accounts a ON e.account_id = a.id;

GRANT SELECT ON public.civic_events TO anon, authenticated;

-- ============================================================================
-- STEP 8: Update RLS policies on orgs, people, roles to allow authenticated updates
-- ============================================================================

-- Allow authenticated users to update editable fields on orgs
DROP POLICY IF EXISTS "Service role can manage orgs" ON civic.orgs;
CREATE POLICY "Authenticated users can update orgs"
  ON civic.orgs FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to update editable fields on people
DROP POLICY IF EXISTS "Service role can manage people" ON civic.people;
CREATE POLICY "Authenticated users can update people"
  ON civic.people FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to update editable fields on roles
DROP POLICY IF EXISTS "Service role can manage roles" ON civic.roles;
CREATE POLICY "Authenticated users can update roles"
  ON civic.roles FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Keep service_role full access
CREATE POLICY "Service role can manage orgs"
  ON civic.orgs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage people"
  ON civic.people FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage roles"
  ON civic.roles FOR ALL TO service_role USING (true) WITH CHECK (true);

