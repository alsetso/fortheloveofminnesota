-- Create mentions table - simplified replacement for pins table
-- This table has the most basic columns but works just like the pins table

-- ============================================================================
-- STEP 1: Drop existing mentions table if it exists
-- ============================================================================

DROP TABLE IF EXISTS public.mentions CASCADE;

-- ============================================================================
-- STEP 2: Create mentions table
-- ============================================================================

CREATE TABLE public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Coordinates (Mapbox optimal: double precision)
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  
  -- Core content field
  description TEXT,
  
  -- Relational field
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Visibility and status
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'only_me')),
  archived BOOLEAN NOT NULL DEFAULT false,
  
  -- Date fields
  post_date TIMESTAMP WITH TIME ZONE, -- For year filtering on the map
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create indexes for optimal performance
-- ============================================================================

-- Spatial index for lat/lng queries (Mapbox optimal)
CREATE INDEX idx_mentions_lat_lng ON public.mentions(lat, lng);

-- Index on account_id for ownership queries
CREATE INDEX idx_mentions_account_id ON public.mentions(account_id) WHERE account_id IS NOT NULL;

-- Index on created_at for sorting
CREATE INDEX idx_mentions_created_at ON public.mentions(created_at DESC);

-- Index on visibility for filtering
CREATE INDEX idx_mentions_visibility ON public.mentions(visibility) WHERE visibility IS NOT NULL;

-- Index for archived filtering
CREATE INDEX idx_mentions_archived ON public.mentions(archived) WHERE archived = false;

-- Index for post_date (year filtering)
CREATE INDEX idx_mentions_post_date ON public.mentions(post_date) WHERE post_date IS NOT NULL;

-- Partial index for active (non-archived) mentions
CREATE INDEX idx_mentions_active ON public.mentions(account_id, visibility, created_at DESC) 
  WHERE archived = false;

-- Composite indexes for RLS performance
CREATE INDEX idx_mentions_account_id_visibility ON public.mentions(account_id, visibility) 
  WHERE visibility = 'public';

CREATE INDEX idx_mentions_visibility_account_id ON public.mentions(visibility, account_id) 
  WHERE visibility IN ('public', 'only_me');

-- ============================================================================
-- STEP 4: Create updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_mentions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Create trigger
-- ============================================================================

CREATE TRIGGER update_mentions_updated_at
  BEFORE UPDATE ON public.mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mentions_updated_at();

-- ============================================================================
-- STEP 6: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS policies (same as pins table)
-- ============================================================================

-- SELECT: Public mentions visible to everyone, only_me mentions visible to owner
-- Users can always see their own mentions (including archived ones)
CREATE POLICY "mentions_select"
  ON public.mentions
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Users can always see their own mentions (including archived)
    (
      account_id IS NOT NULL
      AND public.user_owns_account(account_id)
    )
    OR
    -- Public mentions (not archived) are visible to everyone
    (visibility = 'public' AND archived = false)
    OR
    -- Only_me mentions (not archived) are visible only to their owner
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND public.user_owns_account(account_id)
      AND archived = false
    )
  );

-- INSERT: Authenticated users can insert mentions for accounts they own
-- Anonymous users can insert mentions for guest accounts (user_id IS NULL)
CREATE POLICY "mentions_insert"
  ON public.mentions
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

-- UPDATE: Authenticated users can update mentions for accounts they own
CREATE POLICY "mentions_update"
  ON public.mentions
  FOR UPDATE
  TO authenticated
  USING (
    -- Check old row: user must own the mention
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  )
  WITH CHECK (
    -- Check new row: ensure account_id is not null and user still owns it
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- DELETE: Authenticated users can delete mentions for accounts they own
CREATE POLICY "mentions_delete"
  ON public.mentions
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentions TO authenticated;
GRANT SELECT, INSERT ON public.mentions TO anon;

-- ============================================================================
-- STEP 9: Add comments
-- ============================================================================

COMMENT ON TABLE public.mentions IS 'Simplified mentions table with basic columns. Works like pins table but with minimal schema.';
COMMENT ON COLUMN public.mentions.id IS 'Unique mention ID (UUID)';
COMMENT ON COLUMN public.mentions.lat IS 'Latitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.mentions.lng IS 'Longitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.mentions.description IS 'Text content for the mention';
COMMENT ON COLUMN public.mentions.account_id IS 'Account that owns this mention (required)';
COMMENT ON COLUMN public.mentions.visibility IS 'Mention visibility: ''public'' (visible to everyone) or ''only_me'' (visible only to creator)';
COMMENT ON COLUMN public.mentions.archived IS 'Soft delete flag. When true, mention is archived (treated as deleted but data is preserved). Archived mentions are excluded from all public queries.';
COMMENT ON COLUMN public.mentions.post_date IS 'Date when the event/memory happened. Used for year filtering on the map. Can be up to 100 years in the past. Defaults to created_at if not specified.';
COMMENT ON COLUMN public.mentions.created_at IS 'Mention creation timestamp';
COMMENT ON COLUMN public.mentions.updated_at IS 'Last update timestamp (auto-updated)';

COMMENT ON POLICY "mentions_select" ON public.mentions IS
  'Public mentions (not archived) are visible to everyone. Only_me mentions are visible only to their owner.';

COMMENT ON POLICY "mentions_insert" ON public.mentions IS
  'Authenticated users can insert mentions for accounts they own. Anonymous users can insert mentions for guest accounts.';

COMMENT ON POLICY "mentions_update" ON public.mentions IS
  'Authenticated users can update mentions for accounts they own.';

COMMENT ON POLICY "mentions_delete" ON public.mentions IS
  'Authenticated users can delete mentions for accounts they own.';

