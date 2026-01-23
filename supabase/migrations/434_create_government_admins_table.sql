-- Create government_admins table for government account setup
-- Links to accounts.id and civic.ctu_boundaries for government account management

-- ============================================================================
-- STEP 1: Create government_admins table
-- ============================================================================

CREATE TABLE public.government_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL
    REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Organization information
  organization_name TEXT NOT NULL,
  description TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  
  -- CTU (City, Township, Unorganized Territory) reference
  ctu_id UUID
    REFERENCES civic.ctu_boundaries(id) ON DELETE SET NULL,
  ctu_name TEXT,
  ctu_class TEXT,
  county_name TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'in_review' CHECK (status IN ('in_review', 'approved')),
  
  -- Onboarding
  onboarded BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX government_admins_account_id_idx
  ON public.government_admins (account_id);

CREATE INDEX government_admins_organization_name_idx
  ON public.government_admins (organization_name) WHERE organization_name IS NOT NULL;

CREATE INDEX government_admins_email_idx
  ON public.government_admins (email) WHERE email IS NOT NULL;

CREATE INDEX government_admins_status_idx
  ON public.government_admins (status);

CREATE INDEX government_admins_ctu_id_idx
  ON public.government_admins (ctu_id) WHERE ctu_id IS NOT NULL;

CREATE INDEX government_admins_county_name_idx
  ON public.government_admins (county_name) WHERE county_name IS NOT NULL;

CREATE INDEX government_admins_onboarded_idx
  ON public.government_admins (onboarded) WHERE onboarded = true;

-- ============================================================================
-- STEP 3: Create function to enforce 3 government admins per account limit
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_government_admins_account_limit()
RETURNS TRIGGER AS $$
DECLARE
  gov_admin_count INTEGER;
BEGIN
  -- Count existing government admin records for this account (excluding current record if updating)
  SELECT COUNT(*) INTO gov_admin_count
  FROM public.government_admins
  WHERE account_id = NEW.account_id
    AND (TG_OP = 'INSERT' OR id != NEW.id);
  
  -- Check if limit exceeded
  IF gov_admin_count >= 3 THEN
    RAISE EXCEPTION 'Account cannot have more than 3 government admin records';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Create trigger to update updated_at
-- ============================================================================

CREATE TRIGGER update_government_admins_updated_at
  BEFORE UPDATE ON public.government_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 5: Create function to prevent users from changing status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_government_admin_status_change_by_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user is trying to change status and is not an admin
  IF OLD.status != NEW.status AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change government admin status';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Create trigger to enforce account limit
-- ============================================================================

CREATE TRIGGER check_government_admins_account_limit_trigger
  BEFORE INSERT OR UPDATE ON public.government_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.check_government_admins_account_limit();

-- ============================================================================
-- STEP 7: Create trigger to prevent status changes by non-admins
-- ============================================================================

CREATE TRIGGER prevent_government_admin_status_change_trigger
  BEFORE UPDATE ON public.government_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_government_admin_status_change_by_user();

-- ============================================================================
-- STEP 8: Enable RLS
-- ============================================================================

ALTER TABLE public.government_admins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: Create RLS policies
-- ============================================================================

-- Users can view their own government admin records (via account ownership)
CREATE POLICY "Users can view own government admins"
  ON public.government_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = government_admins.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Users can insert their own government admin records
CREATE POLICY "Users can insert own government admins"
  ON public.government_admins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = government_admins.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Users can update their own government admin records (but not status - only admins can change status)
-- Note: Status change prevention is handled by a separate trigger function
CREATE POLICY "Users can update own government admins"
  ON public.government_admins
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = government_admins.account_id
      AND accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = government_admins.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Users can delete their own government admin records
CREATE POLICY "Users can delete own government admins"
  ON public.government_admins
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = government_admins.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Public can view approved government admins (for public directory)
CREATE POLICY "Public can view approved government admins"
  ON public.government_admins
  FOR SELECT
  TO authenticated, anon
  USING (status = 'approved');

-- Admins can view all government admins
CREATE POLICY "Admins can view all government admins"
  ON public.government_admins
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all government admins (including status)
CREATE POLICY "Admins can update all government admins"
  ON public.government_admins
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can insert government admins
CREATE POLICY "Admins can insert government admins"
  ON public.government_admins
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can delete all government admins
CREATE POLICY "Admins can delete all government admins"
  ON public.government_admins
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 10: Grant permissions
-- ============================================================================

GRANT SELECT ON public.government_admins TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.government_admins TO authenticated;

-- ============================================================================
-- STEP 11: Add comments
-- ============================================================================

COMMENT ON TABLE public.government_admins IS 'Government admin accounts linked to accounts.id and civic.ctu_boundaries for government account management';
COMMENT ON COLUMN public.government_admins.account_id IS 'References accounts.id - the account that owns this government admin record';
COMMENT ON COLUMN public.government_admins.organization_name IS 'Government organization name';
COMMENT ON COLUMN public.government_admins.description IS 'Organization description';
COMMENT ON COLUMN public.government_admins.contact_name IS 'Contact person name';
COMMENT ON COLUMN public.government_admins.email IS 'Organization email address';
COMMENT ON COLUMN public.government_admins.phone IS 'Organization phone number';
COMMENT ON COLUMN public.government_admins.website IS 'Organization website URL';
COMMENT ON COLUMN public.government_admins.ctu_id IS 'References civic.ctu_boundaries.id - the selected CTU';
COMMENT ON COLUMN public.government_admins.ctu_name IS 'CTU name (denormalized for quick access)';
COMMENT ON COLUMN public.government_admins.ctu_class IS 'CTU class: CITY, TOWNSHIP, or UNORGANIZED TERRITORY';
COMMENT ON COLUMN public.government_admins.county_name IS 'County name (denormalized for quick access)';
COMMENT ON COLUMN public.government_admins.status IS 'Government admin account status: in_review or approved';
COMMENT ON COLUMN public.government_admins.onboarded IS 'Whether the government admin setup has been completed by the user';
