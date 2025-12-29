-- Create events table for accounts to post events to a digital calendar
-- Events can be public (visible to community) or private (only_me)

-- ============================================================================
-- STEP 1: Create events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event details
  title TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 200),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  
  -- Date and time
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Location (optional - can be text or coordinates)
  location_name TEXT,
  location_address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  
  -- Relational field
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Visibility and status
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'only_me')),
  archived BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT events_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ============================================================================
-- STEP 2: Create indexes for optimal performance
-- ============================================================================

-- Index on account_id for ownership queries
CREATE INDEX idx_events_account_id ON public.events(account_id) WHERE account_id IS NOT NULL;

-- Index on start_date for calendar queries (most common)
CREATE INDEX idx_events_start_date ON public.events(start_date);

-- Index on end_date for range queries
CREATE INDEX idx_events_end_date ON public.events(end_date) WHERE end_date IS NOT NULL;

-- Index on created_at for sorting
CREATE INDEX idx_events_created_at ON public.events(created_at DESC);

-- Index on visibility for filtering
CREATE INDEX idx_events_visibility ON public.events(visibility) WHERE visibility = 'public';

-- Index for archived filtering
CREATE INDEX idx_events_archived ON public.events(archived) WHERE archived = false;

-- Composite index for active public events (most common query)
CREATE INDEX idx_events_active_public ON public.events(start_date, visibility, archived) 
  WHERE visibility = 'public' AND archived = false;

-- Spatial index for lat/lng queries (if location is provided)
CREATE INDEX idx_events_lat_lng ON public.events(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Partial index for active (non-archived) events by account
CREATE INDEX idx_events_active_by_account ON public.events(account_id, start_date DESC) 
  WHERE archived = false;

-- ============================================================================
-- STEP 3: Create updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Create trigger
-- ============================================================================

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_events_updated_at();

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies
-- ============================================================================

-- SELECT: Public events visible to everyone, only_me events visible to owner
-- Users can always see their own events (including archived ones)
CREATE POLICY "events_select"
  ON public.events
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Users can always see their own events (including archived)
    (
      account_id IS NOT NULL
      AND public.user_owns_account(account_id)
    )
    OR
    -- Public events (not archived) are visible to everyone
    (visibility = 'public' AND archived = false)
    OR
    -- Only_me events (not archived) are visible only to their owner
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND public.user_owns_account(account_id)
      AND archived = false
    )
  );

-- INSERT: Authenticated users can insert events for accounts they own
-- Anonymous users can insert events for guest accounts (user_id IS NULL)
CREATE POLICY "events_insert"
  ON public.events
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      -- Authenticated users: must own the account
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      -- Anonymous users: account must be a guest account (user_id IS NULL)
      (
        auth.uid() IS NULL
        AND EXISTS (
          SELECT 1 FROM public.accounts
          WHERE accounts.id = account_id
          AND accounts.user_id IS NULL
          AND accounts.guest_id IS NOT NULL
        )
      )
    )
  );

-- UPDATE: Authenticated users can update events for accounts they own
CREATE POLICY "events_update"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    -- Check old row: user must own the event
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  )
  WITH CHECK (
    -- Check new row: ensure account_id is not null and user still owns it
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- DELETE: Authenticated users can delete events for accounts they own
CREATE POLICY "events_delete"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 7: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT ON public.events TO anon;

-- ============================================================================
-- STEP 8: Add comments
-- ============================================================================

COMMENT ON TABLE public.events IS 'Events table for accounts to post events to a digital calendar. Events can be public (visible to community) or private (only_me).';
COMMENT ON COLUMN public.events.id IS 'Unique event ID (UUID)';
COMMENT ON COLUMN public.events.title IS 'Event title (required, max 200 characters)';
COMMENT ON COLUMN public.events.description IS 'Event description (optional, max 2000 characters)';
COMMENT ON COLUMN public.events.start_date IS 'Event start date and time (required)';
COMMENT ON COLUMN public.events.end_date IS 'Event end date and time (optional, must be after start_date)';
COMMENT ON COLUMN public.events.location_name IS 'Location name (e.g., "Minneapolis Convention Center")';
COMMENT ON COLUMN public.events.location_address IS 'Full address of the event location';
COMMENT ON COLUMN public.events.lat IS 'Latitude coordinate (optional, for map display)';
COMMENT ON COLUMN public.events.lng IS 'Longitude coordinate (optional, for map display)';
COMMENT ON COLUMN public.events.account_id IS 'Account that owns this event (required)';
COMMENT ON COLUMN public.events.visibility IS 'Event visibility: ''public'' (visible to everyone) or ''only_me'' (visible only to creator)';
COMMENT ON COLUMN public.events.archived IS 'Soft delete flag. When true, event is archived (treated as deleted but data is preserved). Archived events are excluded from all public queries.';
COMMENT ON COLUMN public.events.created_at IS 'Event creation timestamp';
COMMENT ON COLUMN public.events.updated_at IS 'Last update timestamp (auto-updated)';

COMMENT ON POLICY "events_select" ON public.events IS
  'Public events (not archived) are visible to everyone. Only_me events are visible only to their owner.';

COMMENT ON POLICY "events_insert" ON public.events IS
  'Authenticated users can insert events for accounts they own. Anonymous users can insert events for guest accounts.';

COMMENT ON POLICY "events_update" ON public.events IS
  'Authenticated users can update events for accounts they own.';

COMMENT ON POLICY "events_delete" ON public.events IS
  'Authenticated users can delete events for accounts they own.';

