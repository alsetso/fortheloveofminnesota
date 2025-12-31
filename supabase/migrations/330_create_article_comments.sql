-- Create article_comments table for news article discussions
-- Similar structure to post_comments but for news.generated articles

-- ============================================================================
-- STEP 1: Create article_comments table
-- ============================================================================

CREATE TABLE public.article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT NOT NULL, -- References news.generated.article_id
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.article_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT article_comments_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 2000)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_article_comments_article_id ON public.article_comments(article_id);
CREATE INDEX idx_article_comments_account_id ON public.article_comments(account_id);
CREATE INDEX idx_article_comments_parent_comment_id ON public.article_comments(parent_comment_id);
CREATE INDEX idx_article_comments_created_at ON public.article_comments(created_at DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_article_comments_updated_at 
  BEFORE UPDATE ON public.article_comments 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view comments
CREATE POLICY "Anyone can view article comments"
  ON public.article_comments FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Authenticated users can create comments
CREATE POLICY "Authenticated users can create article comments"
  ON public.article_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own article comments"
  ON public.article_comments FOR UPDATE
  TO authenticated
  USING (public.user_owns_account(account_id))
  WITH CHECK (public.user_owns_account(account_id));

-- Policy: Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete own article comments"
  ON public.article_comments FOR DELETE
  TO authenticated
  USING (
    public.user_owns_account(account_id) OR public.is_admin()
  );

-- ============================================================================
-- STEP 5: Grant permissions
-- ============================================================================

GRANT SELECT ON public.article_comments TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.article_comments TO authenticated;
GRANT ALL ON public.article_comments TO service_role;

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON TABLE public.article_comments IS 'Comments on news articles. Supports threading via parent_comment_id.';
COMMENT ON COLUMN public.article_comments.article_id IS 'References news.generated.article_id - the article this comment is on';
COMMENT ON COLUMN public.article_comments.account_id IS 'Account that created the comment';
COMMENT ON COLUMN public.article_comments.parent_comment_id IS 'Parent comment for threading (null for top-level comments)';
COMMENT ON COLUMN public.article_comments.content IS 'Comment text (1-2000 characters)';

