-- Drop public.article_comments and create news.what_users_are_saying table
-- This table stores user comments on news articles

-- ============================================================================
-- STEP 1: Drop old article_comments table
-- ============================================================================

DROP TABLE IF EXISTS public.article_comments CASCADE;

-- ============================================================================
-- STEP 2: Create news.what_users_are_saying table
-- ============================================================================

CREATE TABLE news.what_users_are_saying (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id TEXT NOT NULL, -- References news.generated.article_id
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES news.what_users_are_saying(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT what_users_are_saying_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 2000)
);

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX idx_what_users_are_saying_response_id ON news.what_users_are_saying(response_id);
CREATE INDEX idx_what_users_are_saying_account_id ON news.what_users_are_saying(account_id);
CREATE INDEX idx_what_users_are_saying_parent_comment_id ON news.what_users_are_saying(parent_comment_id);
CREATE INDEX idx_what_users_are_saying_created_at ON news.what_users_are_saying(created_at DESC);

-- ============================================================================
-- STEP 4: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_what_users_are_saying_updated_at 
  BEFORE UPDATE ON news.what_users_are_saying 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE news.what_users_are_saying ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view comments
CREATE POLICY "Anyone can view what users are saying"
  ON news.what_users_are_saying FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
  ON news.what_users_are_saying FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON news.what_users_are_saying FOR UPDATE
  TO authenticated
  USING (public.user_owns_account(account_id))
  WITH CHECK (public.user_owns_account(account_id));

-- Policy: Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete own comments"
  ON news.what_users_are_saying FOR DELETE
  TO authenticated
  USING (
    public.user_owns_account(account_id) OR public.is_admin()
  );

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON news.what_users_are_saying TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON news.what_users_are_saying TO authenticated;
GRANT ALL ON news.what_users_are_saying TO service_role;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE news.what_users_are_saying IS 'User comments on news articles. Supports threading via parent_comment_id.';
COMMENT ON COLUMN news.what_users_are_saying.response_id IS 'References news.generated.article_id - the article this comment is on';
COMMENT ON COLUMN news.what_users_are_saying.account_id IS 'Account that created the comment';
COMMENT ON COLUMN news.what_users_are_saying.parent_comment_id IS 'Parent comment for threading (null for top-level comments)';
COMMENT ON COLUMN news.what_users_are_saying.content IS 'Comment text (1-2000 characters)';

