-- Drop news.what_users_are_saying and create simple news.comments table
-- Comments are linked to news.generated.id via generated_id

-- ============================================================================
-- STEP 1: Drop old what_users_are_saying table
-- ============================================================================

DROP TABLE IF EXISTS news.what_users_are_saying CASCADE;

-- ============================================================================
-- STEP 2: Create simple news.comments table
-- ============================================================================

CREATE TABLE news.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_id UUID NOT NULL REFERENCES news.generated(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES news.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT comments_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 2000)
);

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX idx_comments_generated_id ON news.comments(generated_id);
CREATE INDEX idx_comments_account_id ON news.comments(account_id);
CREATE INDEX idx_comments_parent_comment_id ON news.comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON news.comments(created_at DESC);

-- ============================================================================
-- STEP 4: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_comments_updated_at 
  BEFORE UPDATE ON news.comments 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE news.comments ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view comments
CREATE POLICY "Anyone can view comments"
  ON news.comments FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
  ON news.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON news.comments FOR UPDATE
  TO authenticated
  USING (public.user_owns_account(account_id))
  WITH CHECK (public.user_owns_account(account_id));

-- Policy: Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete own comments"
  ON news.comments FOR DELETE
  TO authenticated
  USING (
    public.user_owns_account(account_id) OR public.is_admin()
  );

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON news.comments TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON news.comments TO authenticated;
GRANT ALL ON news.comments TO service_role;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE news.comments IS 'User comments on news articles. Supports threading via parent_comment_id.';
COMMENT ON COLUMN news.comments.generated_id IS 'References news.generated.id (UUID) - the article this comment is on';
COMMENT ON COLUMN news.comments.account_id IS 'Account that created the comment';
COMMENT ON COLUMN news.comments.parent_comment_id IS 'Parent comment for threading (null for top-level comments)';
COMMENT ON COLUMN news.comments.content IS 'Comment text (1-2000 characters)';

