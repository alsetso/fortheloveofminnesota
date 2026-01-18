-- Fix mentions_likes RLS policies to use user_owns_account() helper function
-- The original policies tried to query accounts table directly, which can be blocked by RLS
-- Using user_owns_account() (SECURITY DEFINER) bypasses RLS and works correctly

-- ============================================================================
-- STEP 1: Drop existing policies
-- ============================================================================

DROP POLICY IF EXISTS "mentions_likes_select_public" ON public.mentions_likes;
DROP POLICY IF EXISTS "mentions_likes_insert" ON public.mentions_likes;
DROP POLICY IF EXISTS "mentions_likes_delete" ON public.mentions_likes;

-- ============================================================================
-- STEP 2: Recreate policies with user_owns_account() helper
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
-- STEP 3: Ensure GRANT statements exist (idempotent)
-- ============================================================================

GRANT SELECT, INSERT, DELETE ON public.mentions_likes TO authenticated;
GRANT SELECT ON public.mentions_likes TO anon;
