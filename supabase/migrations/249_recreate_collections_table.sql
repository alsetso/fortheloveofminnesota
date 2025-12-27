-- Drop old pin_collections table and create new simplified collections table
-- Changes: renamed to 'collections', removed color, added visibility

-- ============================================================================
-- STEP 1: Drop old table and related objects
-- ============================================================================

-- Remove FK from pins first
ALTER TABLE public.pins DROP COLUMN IF EXISTS collection_id;

-- Drop old table (cascades policies, triggers, indexes)
DROP TABLE IF EXISTS public.pin_collections CASCADE;

-- ============================================================================
-- STEP 2: Create new collections table
-- ============================================================================

CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📍',
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Add indexes
-- ============================================================================

CREATE INDEX idx_collections_account_id ON public.collections(account_id);
CREATE INDEX idx_collections_visibility ON public.collections(visibility);
CREATE INDEX idx_collections_display_order ON public.collections(display_order);
CREATE INDEX idx_collections_is_default ON public.collections(is_default) WHERE is_default = true;

-- ============================================================================
-- STEP 4: Add updated_at trigger
-- ============================================================================

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 5: Add collection_id foreign key to pins table
-- ============================================================================

ALTER TABLE public.pins
  ADD COLUMN collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL;

CREATE INDEX idx_pins_collection_id ON public.pins(collection_id);

-- ============================================================================
-- STEP 6: Enable RLS
-- ============================================================================

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS policies
-- ============================================================================

-- Public collections are readable by anyone
-- Private collections only readable by owner
CREATE POLICY "Read public collections or own private"
  ON public.collections
  FOR SELECT
  TO authenticated, anon
  USING (
    visibility = 'public' 
    OR (account_id IS NOT NULL AND public.user_owns_account(account_id))
  );

-- Users can insert their own collections
CREATE POLICY "Users can insert own collections"
  ON public.collections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

-- Users can update their own collections
CREATE POLICY "Users can update own collections"
  ON public.collections
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
CREATE POLICY "Users can delete own collections"
  ON public.collections
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 8: Add comments
-- ============================================================================

COMMENT ON TABLE public.collections IS 'Named collections for organizing pins';
COMMENT ON COLUMN public.collections.name IS 'Display name for the collection';
COMMENT ON COLUMN public.collections.emoji IS 'Emoji displayed with the collection';
COMMENT ON COLUMN public.collections.description IS 'Optional description of the collection';
COMMENT ON COLUMN public.collections.visibility IS 'public = visible to all, private = only owner can see';
COMMENT ON COLUMN public.collections.is_default IS 'If true, new pins are automatically added to this collection';
COMMENT ON COLUMN public.collections.display_order IS 'Order in which collections appear in lists';
COMMENT ON COLUMN public.pins.collection_id IS 'Optional reference to a collection for grouping pins';






