-- Create collections table for categorizing mentions
-- Collections have emoji, title, and description
-- Mentions can optionally belong to a collection

-- ============================================================================
-- STEP 1: Create collections table
-- ============================================================================

CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '📍',
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_collections_account_id ON public.collections(account_id);

-- ============================================================================
-- STEP 3: Add updated_at trigger
-- ============================================================================

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Add collection_id foreign key to mentions table
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL;

CREATE INDEX idx_mentions_collection_id ON public.mentions(collection_id) WHERE collection_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Enable RLS
-- ============================================================================

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies
-- ============================================================================

-- SELECT: Users can read their own collections
CREATE POLICY "collections_select"
  ON public.collections
  FOR SELECT
  TO authenticated, anon
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- INSERT: Users can insert their own collections
CREATE POLICY "collections_insert"
  ON public.collections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- UPDATE: Users can update their own collections
CREATE POLICY "collections_update"
  ON public.collections
  FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- DELETE: Users can delete their own collections
CREATE POLICY "collections_delete"
  ON public.collections
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 7: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;

-- ============================================================================
-- STEP 8: Add comments
-- ============================================================================

COMMENT ON TABLE public.collections IS 'Collections for categorizing mentions. Each collection has an emoji, title, and optional description.';
COMMENT ON COLUMN public.collections.id IS 'Unique collection ID (UUID)';
COMMENT ON COLUMN public.collections.account_id IS 'Account that owns this collection';
COMMENT ON COLUMN public.collections.emoji IS 'Emoji displayed with the collection';
COMMENT ON COLUMN public.collections.title IS 'Display title for the collection';
COMMENT ON COLUMN public.collections.description IS 'Optional description of the collection';
COMMENT ON COLUMN public.collections.created_at IS 'Collection creation timestamp';
COMMENT ON COLUMN public.collections.updated_at IS 'Last update timestamp (auto-updated)';
COMMENT ON COLUMN public.mentions.collection_id IS 'Optional reference to a collection for categorizing mentions';

