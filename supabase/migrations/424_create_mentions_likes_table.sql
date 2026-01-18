-- Create mentions_likes table for allowing accounts to like mentions
-- Users can like any mention (including their own) that they can see

-- ============================================================================
-- STEP 1: Create mentions_likes table
-- ============================================================================

CREATE TABLE public.mentions_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL REFERENCES public.mentions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- One like per account per mention
  CONSTRAINT mentions_likes_unique UNIQUE (mention_id, account_id)
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

-- Index for querying likes by mention
CREATE INDEX idx_mentions_likes_mention_id ON public.mentions_likes(mention_id);

-- Index for querying likes by account
CREATE INDEX idx_mentions_likes_account_id ON public.mentions_likes(account_id);

-- Index for ordering by creation date
CREATE INDEX idx_mentions_likes_created_at ON public.mentions_likes(created_at DESC);

-- Composite index for common queries (checking if account liked mention)
CREATE INDEX idx_mentions_likes_mention_account ON public.mentions_likes(mention_id, account_id);

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.mentions_likes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS Policies
-- ============================================================================

-- SELECT: Anyone can view likes on public mentions
-- Authenticated users can view likes on their own mentions (even if private)
CREATE POLICY "mentions_likes_select_public"
  ON public.mentions_likes FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.mentions
      WHERE mentions.id = mentions_likes.mention_id
      AND (
        mentions.visibility = 'public'
        OR (
          mentions.account_id IS NOT NULL
          AND public.user_owns_account(mentions.account_id)
        )
      )
    )
  );

-- INSERT: Authenticated users can like mentions they can see
CREATE POLICY "mentions_likes_insert"
  ON public.mentions_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.mentions
      WHERE mentions.id = mention_id
      AND mentions.archived = false
      AND (
        mentions.visibility = 'public'
        OR (
          mentions.account_id IS NOT NULL
          AND public.user_owns_account(mentions.account_id)
        )
      )
    )
  );

-- DELETE: Users can only delete their own likes
CREATE POLICY "mentions_likes_delete"
  ON public.mentions_likes FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 5: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, DELETE ON public.mentions_likes TO authenticated;
GRANT SELECT ON public.mentions_likes TO anon;

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON TABLE public.mentions_likes IS 'Tracks likes on mentions. Accounts can like any mention they can see, including their own.';
COMMENT ON COLUMN public.mentions_likes.mention_id IS 'Reference to the liked mention';
COMMENT ON COLUMN public.mentions_likes.account_id IS 'Reference to the account that liked the mention';
