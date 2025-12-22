-- Recreate pins table for accounts to drop pins
-- This migration recreates the complete pins table with all columns, indexes, triggers, and RLS policies

-- ============================================================================
-- STEP 1: Create pins table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Coordinates (Mapbox optimal: double precision)
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  
  -- Core content fields
  description TEXT,
  type TEXT,
  emoji TEXT,
  
  -- Media
  media_url TEXT,
  
  -- Relational fields
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  city_id UUID, -- No FK constraint (references atlas.cities but stored as UUID)
  county_id UUID, -- No FK constraint (references atlas.counties but stored as UUID)
  
  -- Visibility and status
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'only_me')),
  archived BOOLEAN NOT NULL DEFAULT false,
  hide_location BOOLEAN NOT NULL DEFAULT false,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  location_metadata JSONB,
  atlas_metadata JSONB,
  
  -- Analytics
  view_count INTEGER NOT NULL DEFAULT 0,
  
  -- Date fields
  event_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for optimal performance
-- ============================================================================

-- Spatial index for lat/lng queries (Mapbox optimal)
CREATE INDEX idx_pins_lat_lng ON public.pins(lat, lng);

-- Index on type for filtering
CREATE INDEX idx_pins_type ON public.pins(type) WHERE type IS NOT NULL;

-- Index on account_id for ownership queries
CREATE INDEX idx_pins_account_id ON public.pins(account_id) WHERE account_id IS NOT NULL;

-- Index on optional relational fields
CREATE INDEX idx_pins_city_id ON public.pins(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX idx_pins_county_id ON public.pins(county_id) WHERE county_id IS NOT NULL;

-- Index on created_at for sorting
CREATE INDEX idx_pins_created_at ON public.pins(created_at DESC);

-- Index on visibility for filtering
CREATE INDEX idx_pins_visibility ON public.pins(visibility) WHERE visibility IS NOT NULL;

-- Index on view_count for analytics
CREATE INDEX idx_pins_view_count ON public.pins(view_count DESC) WHERE view_count > 0;

-- Index on media_url
CREATE INDEX idx_pins_media_url ON public.pins(media_url) WHERE media_url IS NOT NULL;

-- GIN index for tags array
CREATE INDEX idx_pins_tags ON public.pins USING GIN (tags);

-- Indexes for metadata queries
CREATE INDEX idx_pins_location_metadata_category ON public.pins ((location_metadata->>'category'))
  WHERE location_metadata IS NOT NULL;

CREATE INDEX idx_pins_atlas_metadata_type ON public.pins ((atlas_metadata->>'entityType'))
  WHERE atlas_metadata IS NOT NULL;

-- Index for archived filtering
CREATE INDEX idx_pins_archived ON public.pins(archived) WHERE archived = false;

-- Partial index for active (non-archived) pins
CREATE INDEX idx_pins_active ON public.pins(account_id, visibility, created_at DESC) 
  WHERE archived = false;

-- Index for hide_location
CREATE INDEX idx_pins_hide_location ON public.pins (hide_location) WHERE hide_location = true;

-- Index for event_date
CREATE INDEX idx_pins_event_date ON public.pins (event_date) WHERE event_date IS NOT NULL;

-- Composite indexes for RLS performance
CREATE INDEX idx_pins_account_id_visibility ON public.pins(account_id, visibility) 
  WHERE visibility = 'public';

CREATE INDEX idx_pins_visibility_account_id ON public.pins(visibility, account_id) 
  WHERE visibility IN ('public', 'only_me');

-- ============================================================================
-- STEP 3: Create updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_pins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Create trigger
-- ============================================================================

CREATE TRIGGER update_pins_updated_at
  BEFORE UPDATE ON public.pins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pins_updated_at();

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies
-- ============================================================================

-- Policy: Public pins are readable by everyone, private pins only by creator
CREATE POLICY "Public read access for pins"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public pins are visible to everyone
    visibility = 'public'
    AND archived = false
    OR
    -- Private pins (only_me) are only visible to their creator
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND public.user_owns_account(account_id)
      AND archived = false
    )
  );

-- Policy: Authenticated users and anonymous guests can insert pins
CREATE POLICY "Users and guests can insert pins"
  ON public.pins
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      -- Authenticated users: must own the account
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      -- Anonymous guests: account must be a guest account (user_id IS NULL)
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

-- Policy: Authenticated users can update their own pins
CREATE POLICY "Users can update own pins"
  ON public.pins
  FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

-- Policy: Authenticated users can delete their own pins
CREATE POLICY "Users can delete own pins"
  ON public.pins
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 7: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pins TO authenticated;
GRANT SELECT, INSERT ON public.pins TO anon;

-- ============================================================================
-- STEP 8: Add comments
-- ============================================================================

COMMENT ON TABLE public.pins IS 'Public map pins that are readable by everyone. Authenticated users can manage their own pins.';
COMMENT ON COLUMN public.pins.id IS 'Unique pin ID (UUID)';
COMMENT ON COLUMN public.pins.lat IS 'Latitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.pins.lng IS 'Longitude coordinate (double precision for Mapbox optimal performance)';
COMMENT ON COLUMN public.pins.description IS 'Text content for the pin (single source of text)';
COMMENT ON COLUMN public.pins.type IS 'Pin type/category for filtering';
COMMENT ON COLUMN public.pins.emoji IS 'Emoji character(s) to display with the pin (e.g., 🏠, 📍, 🎯)';
COMMENT ON COLUMN public.pins.media_url IS 'URL to photo or video associated with this pin (one media item per pin)';
COMMENT ON COLUMN public.pins.account_id IS 'Account that owns this pin (required for authenticated users)';
COMMENT ON COLUMN public.pins.city_id IS 'Optional reference to a city (stored as UUID, no foreign key constraint)';
COMMENT ON COLUMN public.pins.county_id IS 'Optional reference to a county (stored as UUID, no foreign key constraint)';
COMMENT ON COLUMN public.pins.visibility IS 'Pin visibility: ''public'' (visible to everyone) or ''only_me'' (visible only to creator). Extensible for future types.';
COMMENT ON COLUMN public.pins.archived IS 'Soft delete flag. When true, pin is archived (treated as deleted but data is preserved). Archived pins are excluded from all public queries.';
COMMENT ON COLUMN public.pins.hide_location IS 'When true, pin uses city coordinates instead of exact coordinates. Requires city_id to be set.';
COMMENT ON COLUMN public.pins.tags IS 'Array of text labels for organizing pins (e.g., ["favorite", "work", "family"])';
COMMENT ON COLUMN public.pins.location_metadata IS 'Mapbox feature metadata captured at pin creation (layerId, sourceLayer, name, category, class, type, properties)';
COMMENT ON COLUMN public.pins.atlas_metadata IS 'Atlas entity metadata captured at pin creation (entityId, entityType, name, emoji)';
COMMENT ON COLUMN public.pins.view_count IS 'Total number of times this pin has been viewed (incremented via record_page_view function)';
COMMENT ON COLUMN public.pins.event_date IS 'Date when the event/memory happened. Can be up to 100 years in the past. Defaults to created_at if not specified.';
COMMENT ON COLUMN public.pins.created_at IS 'Pin creation timestamp';
COMMENT ON COLUMN public.pins.updated_at IS 'Last update timestamp (auto-updated)';

COMMENT ON POLICY "Users and guests can insert pins" ON public.pins IS
  'Allows authenticated users to insert pins they own, and anonymous guests to insert pins with guest accounts. Guest accounts are identified by NULL user_id and non-NULL guest_id.';
