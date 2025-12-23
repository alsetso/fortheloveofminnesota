-- Create news_gen table to store user news search queries and RapidAPI responses
-- Connected to accounts table to track which user generated each news search

-- ============================================================================
-- STEP 1: Create news_gen table
-- ============================================================================

CREATE TABLE public.news_gen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- User's custom search input
  user_input TEXT NOT NULL,
  
  -- Full JSON response from RapidAPI news endpoint
  api_response JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_news_gen_account_id ON public.news_gen(account_id);
CREATE INDEX idx_news_gen_created_at ON public.news_gen(created_at DESC);
CREATE INDEX idx_news_gen_user_input ON public.news_gen(user_input);

-- GIN index for JSONB queries on api_response
CREATE INDEX idx_news_gen_api_response ON public.news_gen USING GIN (api_response);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_news_gen_updated_at 
  BEFORE UPDATE ON public.news_gen 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.news_gen ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Users can view their own news_gen records
CREATE POLICY "Users can view their own news_gen"
  ON public.news_gen
  FOR SELECT
  TO authenticated
  USING (public.user_owns_account(account_id));

-- Policy: Users can insert their own news_gen records
CREATE POLICY "Users can insert their own news_gen"
  ON public.news_gen
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_account(account_id));

-- Policy: Users can update their own news_gen records
CREATE POLICY "Users can update their own news_gen"
  ON public.news_gen
  FOR UPDATE
  TO authenticated
  USING (public.user_owns_account(account_id))
  WITH CHECK (public.user_owns_account(account_id));

-- Policy: Users can delete their own news_gen records
CREATE POLICY "Users can delete their own news_gen"
  ON public.news_gen
  FOR DELETE
  TO authenticated
  USING (public.user_owns_account(account_id));

-- Policy: Admins can view all news_gen records
CREATE POLICY "Admins can view all news_gen"
  ON public.news_gen
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Policy: Admins can insert news_gen for any account
CREATE POLICY "Admins can insert news_gen"
  ON public.news_gen
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update any news_gen record
CREATE POLICY "Admins can update news_gen"
  ON public.news_gen
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete any news_gen record
CREATE POLICY "Admins can delete news_gen"
  ON public.news_gen
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_gen TO authenticated;
GRANT ALL ON public.news_gen TO service_role;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE public.news_gen IS 'Stores user-generated news search queries and RapidAPI response data. Connected to accounts table.';
COMMENT ON COLUMN public.news_gen.id IS 'Unique news_gen record ID (UUID)';
COMMENT ON COLUMN public.news_gen.account_id IS 'Reference to the account that generated this news search';
COMMENT ON COLUMN public.news_gen.user_input IS 'The user-provided search query string';
COMMENT ON COLUMN public.news_gen.api_response IS 'Full JSON response from RapidAPI news endpoint, including articles, requestId, count, and curl command';
COMMENT ON COLUMN public.news_gen.created_at IS 'Timestamp when the news search was generated';
COMMENT ON COLUMN public.news_gen.updated_at IS 'Timestamp when the record was last updated';

-- ============================================================================
-- STEP 8: Verification report
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.news_gen;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  news_gen table created in public schema';
  RAISE NOTICE '  Connected to accounts table via account_id foreign key';
  RAISE NOTICE '  RLS policies configured (users can only access their own records, admins can access all)';
  RAISE NOTICE '  GIN index created on api_response for efficient JSONB queries';
END;
$$;

