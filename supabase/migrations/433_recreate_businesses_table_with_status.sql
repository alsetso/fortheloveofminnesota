-- Drop and recreate businesses table with status field
-- Links to accounts.id for business account management

-- ============================================================================
-- STEP 1: Drop existing businesses table if it exists
-- ============================================================================

DROP TABLE IF EXISTS public.businesses CASCADE;

-- ============================================================================
-- STEP 2: Create businesses table with status
-- ===============================drop=============================================

CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL
    REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Business information
  name TEXT NOT NULL,
  description TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  logo_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'in_review' CHECK (status IN ('in_review', 'approved')),
  
  -- Onboarding
  onboarded BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX businesses_account_id_idx
  ON public.businesses (account_id);

CREATE INDEX businesses_name_idx
  ON public.businesses (name) WHERE name IS NOT NULL;

CREATE INDEX businesses_email_idx
  ON public.businesses (email) WHERE email IS NOT NULL;

CREATE INDEX businesses_status_idx
  ON public.businesses (status);

CREATE INDEX businesses_lat_lng_idx
  ON public.businesses (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX businesses_onboarded_idx
  ON public.businesses (onboarded) WHERE onboarded = true;

-- ============================================================================
-- STEP 4: Create function to enforce 3 businesses per account limit
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_businesses_account_limit()
RETURNS TRIGGER AS $$
DECLARE
  business_count INTEGER;
BEGIN
  -- Count existing businesses for this account (excluding current record if updating)
  SELECT COUNT(*) INTO business_count
  FROM public.businesses
  WHERE account_id = NEW.account_id
    AND (TG_OP = 'INSERT' OR id != NEW.id);
  
  -- Check if limit exceeded
  IF business_count >= 3 THEN
    RAISE EXCEPTION 'Account cannot have more than 3 business records';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Create trigger to update updated_at
-- ============================================================================

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 6: Create function to prevent users from changing status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_business_status_change_by_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user is trying to change status and is not an admin
  IF OLD.status != NEW.status AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change business status';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: Create trigger to enforce account limit
-- ============================================================================

CREATE TRIGGER check_businesses_account_limit_trigger
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.check_businesses_account_limit();

-- ============================================================================
-- STEP 8: Create trigger to prevent status changes by non-admins
-- ============================================================================

CREATE TRIGGER prevent_business_status_change_trigger
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_status_change_by_user();

-- ============================================================================
-- STEP 9: Enable RLS
-- ============================================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 10: Create RLS policies
-- ============================================================================

-- Users can view their own businesses (via account ownership)
CREATE POLICY "Users can view own businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = businesses.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Users can insert their own businesses
CREATE POLICY "Users can insert own businesses"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = businesses.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Users can update their own businesses (but not status - only admins can change status)
-- Note: Status change prevention is handled by a separate trigger function
CREATE POLICY "Users can update own businesses"
  ON public.businesses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = businesses.account_id
      AND accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = businesses.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Users can delete their own businesses
CREATE POLICY "Users can delete own businesses"
  ON public.businesses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = businesses.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Public can view approved businesses (for public directory)
CREATE POLICY "Public can view approved businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated, anon
  USING (status = 'approved');

-- Admins can view all businesses
CREATE POLICY "Admins can view all businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all businesses (including status)
CREATE POLICY "Admins can update all businesses"
  ON public.businesses
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can insert businesses
CREATE POLICY "Admins can insert businesses"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can delete all businesses
CREATE POLICY "Admins can delete all businesses"
  ON public.businesses
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 11: Grant permissions
-- ============================================================================

GRANT SELECT ON public.businesses TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.businesses TO authenticated;

-- ============================================================================
-- STEP 12: Add comments
-- ============================================================================

COMMENT ON TABLE public.businesses IS 'Business accounts linked to accounts.id for business account management';
COMMENT ON COLUMN public.businesses.account_id IS 'References accounts.id - the account that owns this business';
COMMENT ON COLUMN public.businesses.name IS 'Business name';
COMMENT ON COLUMN public.businesses.description IS 'Business description';
COMMENT ON COLUMN public.businesses.contact_name IS 'Contact person name';
COMMENT ON COLUMN public.businesses.email IS 'Business email address';
COMMENT ON COLUMN public.businesses.phone IS 'Business phone number';
COMMENT ON COLUMN public.businesses.website IS 'Business website URL';
COMMENT ON COLUMN public.businesses.address IS 'Full business address';
COMMENT ON COLUMN public.businesses.lat IS 'Business latitude coordinate';
COMMENT ON COLUMN public.businesses.lng IS 'Business longitude coordinate';
COMMENT ON COLUMN public.businesses.logo_url IS 'URL to business logo image';
COMMENT ON COLUMN public.businesses.status IS 'Business account status: in_review or approved';
COMMENT ON COLUMN public.businesses.onboarded IS 'Whether the business setup has been completed by the user';
