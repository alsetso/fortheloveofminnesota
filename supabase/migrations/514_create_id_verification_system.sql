-- Create ID verification system
-- Allows accounts to upload state ID and billing statement for identity verification
-- Admins can approve or reject submissions

-- ============================================================================
-- STEP 1: Create id schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS id;

COMMENT ON SCHEMA id IS 'Schema for identity verification system';

-- ============================================================================
-- STEP 2: Create verification status enum
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE id.verification_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

COMMENT ON TYPE id.verification_status IS 'Status of identity verification submission';

-- ============================================================================
-- STEP 3: Create id_verifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS id.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Document URLs (stored in id-verification-documents storage bucket)
  state_id_front_url TEXT,
  state_id_back_url TEXT,
  billing_statement_front_url TEXT,
  billing_statement_back_url TEXT,
  
  -- Verification metadata
  status id.verification_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  
  -- Admin review
  reviewed_by_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_account_id ON id.verifications(account_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON id.verifications(status);
CREATE INDEX IF NOT EXISTS idx_verifications_created_at ON id.verifications(created_at DESC);

COMMENT ON TABLE id.verifications IS 'Identity verification submissions from accounts';
COMMENT ON COLUMN id.verifications.state_id_front_url IS 'URL to front of state ID document';
COMMENT ON COLUMN id.verifications.state_id_back_url IS 'URL to back of state ID document';
COMMENT ON COLUMN id.verifications.billing_statement_front_url IS 'URL to front of billing statement with address';
COMMENT ON COLUMN id.verifications.billing_statement_back_url IS 'URL to back of billing statement';
COMMENT ON COLUMN id.verifications.status IS 'Current verification status';
COMMENT ON COLUMN id.verifications.rejection_reason IS 'Reason for rejection if status is rejected';
COMMENT ON COLUMN id.verifications.reviewed_by_account_id IS 'Account ID of admin who reviewed this submission';
COMMENT ON COLUMN id.verifications.reviewed_at IS 'Timestamp when admin reviewed this submission';

-- ============================================================================
-- STEP 4: Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION id.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_verifications_updated_at
  BEFORE UPDATE ON id.verifications
  FOR EACH ROW
  EXECUTE FUNCTION id.update_updated_at_column();

-- ============================================================================
-- STEP 5: Create storage bucket for ID verification documents
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-verification-documents',
  'id-verification-documents',
  false, -- Private bucket - only accessible by account owner and admins
  10485760, -- 10MB limit (larger than usual for high-res document scans)
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Note: Storage bucket for ID verification documents
-- Path structure: {account_id}/{verification_id}/{document_type}/{filename}

-- ============================================================================
-- STEP 6: Create RLS policies for verifications table
-- ============================================================================

ALTER TABLE id.verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verifications
CREATE POLICY "Users can view their own verifications"
  ON id.verifications
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own verifications
CREATE POLICY "Users can insert their own verifications"
  ON id.verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- Users can update their own pending verifications
CREATE POLICY "Users can update their own pending verifications"
  ON id.verifications
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
    AND status = 'pending'
  )
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
    AND status = 'pending'
  );

-- Admins can view all verifications
CREATE POLICY "Admins can view all verifications"
  ON id.verifications
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all verifications (for approval/rejection)
CREATE POLICY "Admins can update all verifications"
  ON id.verifications
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- STEP 7: Create storage policies for id-verification-documents bucket
-- ============================================================================

-- Users can upload documents to their own account folder
CREATE POLICY "Users can upload their own verification documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'id-verification-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- Users can view their own documents
CREATE POLICY "Users can view their own verification documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'id-verification-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own documents (only if verification is pending)
CREATE POLICY "Users can delete their own pending verification documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'id-verification-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.accounts WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM id.verifications v
      JOIN public.accounts a ON v.account_id = a.id
      WHERE a.user_id = auth.uid()
      AND v.status = 'pending'
      AND (
        name LIKE '%/' || (storage.foldername(name))[2] || '/%'
        OR name LIKE '%/' || (storage.foldername(name))[2] || '%'
      )
    )
  );

-- Admins can view all documents
CREATE POLICY "Admins can view all verification documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'id-verification-documents'
    AND public.is_admin()
  );

-- Admins can delete all documents
CREATE POLICY "Admins can delete all verification documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'id-verification-documents'
    AND public.is_admin()
  );

-- ============================================================================
-- STEP 8: Create helper function to get account verification status
-- ============================================================================

CREATE OR REPLACE FUNCTION id.get_account_verification_status(account_uuid UUID)
RETURNS TABLE (
  has_verification BOOLEAN,
  latest_status id.verification_status,
  latest_created_at TIMESTAMPTZ,
  latest_reviewed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(SELECT 1 FROM id.verifications WHERE account_id = account_uuid) as has_verification,
    COALESCE(
      (SELECT status FROM id.verifications 
       WHERE account_id = account_uuid 
       ORDER BY created_at DESC LIMIT 1),
      'pending'::id.verification_status
    ) as latest_status,
    (SELECT created_at FROM id.verifications 
     WHERE account_id = account_uuid 
     ORDER BY created_at DESC LIMIT 1) as latest_created_at,
    (SELECT reviewed_at FROM id.verifications 
     WHERE account_id = account_uuid 
     ORDER BY created_at DESC LIMIT 1) as latest_reviewed_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION id.get_account_verification_status IS 'Get the latest verification status for an account';

-- ============================================================================
-- STEP 9: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA id TO authenticated;
GRANT SELECT, INSERT, UPDATE ON id.verifications TO authenticated;
GRANT EXECUTE ON FUNCTION id.get_account_verification_status TO authenticated;
