-- Create group_requests table for private group join requests
-- Allows users to request to join private groups
-- Admins can approve or deny requests

-- ============================================================================
-- STEP 1: Create group_requests table
-- ============================================================================

CREATE TABLE public.group_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Request status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  
  -- Optional message from requester
  message TEXT,
  
  -- Who processed the request (if approved/denied)
  processed_by_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(group_id, account_id),
  CONSTRAINT group_requests_message_length CHECK (message IS NULL OR char_length(message) <= 500)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_group_requests_group_id ON public.group_requests(group_id);
CREATE INDEX idx_group_requests_account_id ON public.group_requests(account_id);
CREATE INDEX idx_group_requests_status ON public.group_requests(status) WHERE status = 'pending';
CREATE INDEX idx_group_requests_created_at ON public.group_requests(created_at DESC);

-- ============================================================================
-- STEP 3: Enable RLS
-- ============================================================================

ALTER TABLE public.group_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS policies
-- ============================================================================

-- Users can view their own requests
CREATE POLICY "group_requests_select_own"
  ON public.group_requests FOR SELECT
  TO authenticated
  USING (
    account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Group admins can view requests for their groups
CREATE POLICY "group_requests_select_admin"
  ON public.group_requests FOR SELECT
  TO authenticated
  USING (
    public.is_group_admin(group_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Users can create requests for private groups
CREATE POLICY "group_requests_insert"
  ON public.group_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
    AND NOT EXISTS (
      -- Don't allow if already a member
      SELECT 1 FROM public.group_members
      WHERE group_id = group_requests.group_id
      AND account_id = group_requests.account_id
    )
    AND NOT EXISTS (
      -- Don't allow if already has a pending request
      SELECT 1 FROM public.group_requests
      WHERE group_id = group_requests.group_id
      AND account_id = group_requests.account_id
      AND status = 'pending'
    )
    AND EXISTS (
      -- Only allow for private groups
      SELECT 1 FROM public.groups
      WHERE id = group_requests.group_id
      AND visibility = 'private'::public.group_visibility
      AND is_active = true
    )
  );

-- Group admins can update requests (approve/deny)
CREATE POLICY "group_requests_update"
  ON public.group_requests FOR UPDATE
  TO authenticated
  USING (
    public.is_group_admin(group_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  )
  WITH CHECK (
    public.is_group_admin(group_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Users can delete their own pending requests
CREATE POLICY "group_requests_delete_own"
  ON public.group_requests FOR DELETE
  TO authenticated
  USING (
    account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
    AND status = 'pending'
  );

-- ============================================================================
-- STEP 5: Create trigger to auto-add member when request is approved
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_approved_group_request()
RETURNS TRIGGER AS $$
BEGIN
  -- When a request is approved, automatically add the user as a member
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    INSERT INTO public.group_members (group_id, account_id, is_admin)
    VALUES (NEW.group_id, NEW.account_id, false)
    ON CONFLICT (group_id, account_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER handle_approved_group_request_trigger
  AFTER UPDATE ON public.group_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION public.handle_approved_group_request();

-- ============================================================================
-- STEP 6: Create trigger to update updated_at
-- ============================================================================

CREATE TRIGGER update_group_requests_updated_at
  BEFORE UPDATE ON public.group_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE public.group_requests IS 'Join requests for private groups';
COMMENT ON COLUMN public.group_requests.status IS 'pending: awaiting admin approval, approved: user added as member, denied: request rejected';
COMMENT ON COLUMN public.group_requests.message IS 'Optional message from requester explaining why they want to join';

-- ============================================================================
-- STEP 8: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
