-- Create businesses table for business account setup
-- Links to accounts.id for business account management

-- ============================================================================
-- STEP 1: Create businesses table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.businesses (
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
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS businesses_account_id_idx
  ON public.businesses (account_id);

CREATE INDEX IF NOT EXISTS businesses_name_idx
  ON public.businesses (name) WHERE name IS NOT NULL;

CREATE INDEX IF NOT EXISTS businesses_email_idx
  ON public.businesses (email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS businesses_lat_lng_idx
  ON public.businesses (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================================================
-- STEP 3: Create trigger to update updated_at
-- ============================================================================

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable RLS
-- ============================================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies
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

-- Users can update their own businesses
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

-- Public can view all businesses (for public directory)
CREATE POLICY "Public can view all businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Admins can view all businesses
CREATE POLICY "Admins can view all businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all businesses
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
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON public.businesses TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.businesses TO authenticated;

-- ============================================================================
-- STEP 7: Add comments
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
