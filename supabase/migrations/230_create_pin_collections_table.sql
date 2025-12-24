-- Create pin_collections table for organizing pins into named groups
-- Users can create collections with emoji + name, then assign pins to collections

-- ============================================================================
-- STEP 1: Create pin_collections table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pin_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📍',
  description TEXT,
  color TEXT, -- Optional hex color for visual styling (e.g., '#FF5733')
  is_default BOOLEAN NOT NULL DEFAULT false, -- One collection can be marked as default
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Add indexes
-- ============================================================================

CREATE INDEX idx_pin_collections_account_id ON public.pin_collections(account_id);
CREATE INDEX idx_pin_collections_display_order ON public.pin_collections(display_order);
CREATE INDEX idx_pin_collections_is_default ON public.pin_collections(is_default) WHERE is_default = true;

-- ============================================================================
-- STEP 3: Add updated_at trigger
-- ============================================================================

CREATE TRIGGER update_pin_collections_updated_at
  BEFORE UPDATE ON public.pin_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Add collection_id foreign key to pins table
-- ============================================================================

ALTER TABLE public.pins
  ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.pin_collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pins_collection_id ON public.pins(collection_id);

-- ============================================================================
-- STEP 5: Enable RLS on pin_collections
-- ============================================================================

ALTER TABLE public.pin_collections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies for pin_collections
-- ============================================================================

-- Public can read collections (to display on profile pages)
CREATE POLICY "Public read access for pin_collections"
  ON public.pin_collections
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Users can insert their own collections
CREATE POLICY "Users can insert own pin_collections"
  ON public.pin_collections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

-- Users can update their own collections
CREATE POLICY "Users can update own pin_collections"
  ON public.pin_collections
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

-- Users can delete their own collections
CREATE POLICY "Users can delete own pin_collections"
  ON public.pin_collections
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE public.pin_collections IS 'Named collections for organizing pins with emoji and optional color styling';
COMMENT ON COLUMN public.pin_collections.name IS 'Display name for the collection (e.g., "Favorite Spots", "Work Locations")';
COMMENT ON COLUMN public.pin_collections.emoji IS 'Emoji displayed with the collection (e.g., "⭐", "🏠", "🍕")';
COMMENT ON COLUMN public.pin_collections.description IS 'Optional longer description of what pins are in this collection';
COMMENT ON COLUMN public.pin_collections.color IS 'Optional hex color for visual styling on map (e.g., "#FF5733")';
COMMENT ON COLUMN public.pin_collections.is_default IS 'If true, new pins are automatically added to this collection';
COMMENT ON COLUMN public.pin_collections.display_order IS 'Order in which collections appear in lists/dropdowns';
COMMENT ON COLUMN public.pins.collection_id IS 'Optional reference to a pin_collection for grouping pins';




