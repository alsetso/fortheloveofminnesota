-- Create FAQs table for user-submitted questions with admin moderation
-- Users can submit questions, admins control visibility and provide answers

-- ============================================================================
-- STEP 1: Create FAQs table
-- ============================================================================

CREATE TABLE public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Question content
  question TEXT NOT NULL,
  answer TEXT, -- Admin-provided answer (nullable until admin responds)
  
  -- Visibility control
  is_visible BOOLEAN NOT NULL DEFAULT false, -- Admin controls visibility
  
  -- Optional: track who asked (if authenticated)
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT faqs_question_length CHECK (char_length(question) >= 1 AND char_length(question) <= 2000),
  CONSTRAINT faqs_answer_length CHECK (answer IS NULL OR char_length(answer) <= 10000)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX faqs_is_visible_idx
  ON public.faqs (is_visible)
  WHERE is_visible = true;

CREATE INDEX faqs_account_id_idx
  ON public.faqs (account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX faqs_created_at_idx
  ON public.faqs (created_at DESC);

CREATE INDEX faqs_has_answer_idx
  ON public.faqs (id)
  WHERE answer IS NOT NULL AND is_visible = true;

-- ============================================================================
-- STEP 3: Create trigger to update updated_at
-- ============================================================================

CREATE TRIGGER update_faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable RLS
-- ============================================================================

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies
-- ============================================================================

-- Anyone can view visible FAQs (published questions with answers)
CREATE POLICY "Anyone can view visible FAQs"
  ON public.faqs
  FOR SELECT
  TO authenticated, anon
  USING (is_visible = true);

-- Authenticated users can submit questions (insert)
CREATE POLICY "Authenticated users can submit questions"
  ON public.faqs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can view their own questions (even if not visible)
CREATE POLICY "Users can view own questions"
  ON public.faqs
  FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = faqs.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Admins can view all FAQs
CREATE POLICY "Admins can view all FAQs"
  ON public.faqs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all FAQs (to add answers, change visibility, etc.)
CREATE POLICY "Admins can update all FAQs"
  ON public.faqs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete all FAQs
CREATE POLICY "Admins can delete all FAQs"
  ON public.faqs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON public.faqs TO authenticated, anon;
GRANT INSERT ON public.faqs TO authenticated;
GRANT UPDATE, DELETE ON public.faqs TO authenticated;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE public.faqs IS 
  'User-submitted FAQ questions with admin moderation. Authenticated users can submit questions, admins control visibility and provide answers.';

COMMENT ON COLUMN public.faqs.question IS 
  'User-submitted question (1-2000 characters)';

COMMENT ON COLUMN public.faqs.answer IS 
  'Admin-provided answer (nullable until admin responds, max 10000 characters)';

COMMENT ON COLUMN public.faqs.is_visible IS 
  'Whether this FAQ is visible to the public. Only FAQs with is_visible=true are shown on the public FAQs page.';

COMMENT ON COLUMN public.faqs.account_id IS 
  'Optional reference to the account that submitted the question. Null for anonymous submissions.';
