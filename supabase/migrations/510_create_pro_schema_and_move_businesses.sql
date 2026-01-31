-- Create pro schema and move businesses table
-- Update accounts RLS to exclude accounts with businesses from public view

-- ============================================================================
-- STEP 1: Create pro schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS pro;

-- Grant usage on schema
GRANT USAGE ON SCHEMA pro TO authenticated;
GRANT USAGE ON SCHEMA pro TO anon;

-- ============================================================================
-- STEP 2: Move businesses table from public to pro schema
-- ============================================================================

-- Create businesses table in pro schema with same structure
CREATE TABLE pro.businesses (
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

-- Migrate data from public.businesses to pro.businesses
INSERT INTO pro.businesses (
  id, account_id, name, description, contact_name, email, phone, website,
  address, lat, lng, logo_url, status, onboarded, created_at, updated_at
)
SELECT 
  id, account_id, name, description, contact_name, email, phone, website,
  address, lat, lng, logo_url, status, onboarded, created_at, updated_at
FROM public.businesses
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 3: Create indexes on pro.businesses
-- ============================================================================

CREATE INDEX businesses_account_id_idx
  ON pro.businesses (account_id);

CREATE INDEX businesses_name_idx
  ON pro.businesses (name) WHERE name IS NOT NULL;

CREATE INDEX businesses_email_idx
  ON pro.businesses (email) WHERE email IS NOT NULL;

CREATE INDEX businesses_status_idx
  ON pro.businesses (status);

CREATE INDEX businesses_lat_lng_idx
  ON pro.businesses (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX businesses_onboarded_idx
  ON pro.businesses (onboarded) WHERE onboarded = true;

-- ============================================================================
-- STEP 4: Create functions for pro.businesses
-- ============================================================================

-- Function to enforce 3 businesses per account limit
CREATE OR REPLACE FUNCTION pro.check_businesses_account_limit()
RETURNS TRIGGER AS $$
DECLARE
  business_count INTEGER;
BEGIN
  -- Count existing businesses for this account (excluding current record if updating)
  SELECT COUNT(*) INTO business_count
  FROM pro.businesses
  WHERE account_id = NEW.account_id
    AND (TG_OP = 'INSERT' OR id != NEW.id);
  
  -- Check if limit exceeded
  IF business_count >= 3 THEN
    RAISE EXCEPTION 'Account cannot have more than 3 business records';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent users from changing status
CREATE OR REPLACE FUNCTION pro.prevent_business_status_change_by_user()
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
-- STEP 5: Create triggers for pro.businesses
-- ============================================================================

-- Trigger to update updated_at
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON pro.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to enforce 3 businesses per account limit
CREATE TRIGGER check_businesses_account_limit_trigger
  BEFORE INSERT OR UPDATE ON pro.businesses
  FOR EACH ROW
  EXECUTE FUNCTION pro.check_businesses_account_limit();

-- Trigger to prevent status changes by non-admins
CREATE TRIGGER prevent_business_status_change_trigger
  BEFORE UPDATE ON pro.businesses
  FOR EACH ROW
  EXECUTE FUNCTION pro.prevent_business_status_change_by_user();

-- ============================================================================
-- STEP 6: Enable RLS on pro.businesses
-- ============================================================================

ALTER TABLE pro.businesses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS policies for pro.businesses
-- ============================================================================

-- Users can view their own businesses (via account ownership)
CREATE POLICY "Users can view own businesses"
  ON pro.businesses
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
  ON pro.businesses
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
CREATE POLICY "Users can update own businesses"
  ON pro.businesses
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
  ON pro.businesses
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
  ON pro.businesses
  FOR SELECT
  TO authenticated, anon
  USING (status = 'approved');

-- Admins can view all businesses
CREATE POLICY "Admins can view all businesses"
  ON pro.businesses
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all businesses (including status)
CREATE POLICY "Admins can update all businesses"
  ON pro.businesses
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can insert businesses
CREATE POLICY "Admins can insert businesses"
  ON pro.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can delete all businesses
CREATE POLICY "Admins can delete all businesses"
  ON pro.businesses
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 8: Grant permissions on pro.businesses
-- ============================================================================

GRANT SELECT ON pro.businesses TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON pro.businesses TO authenticated;

-- ============================================================================
-- STEP 9: Drop public.businesses table (before creating view with same name)
-- ============================================================================

DROP TABLE IF EXISTS public.businesses CASCADE;

-- ============================================================================
-- STEP 10: Create public view for Supabase client compatibility
-- ============================================================================

-- Create a view in public schema that points to pro.businesses
-- This allows Supabase client to access businesses table without schema qualification
CREATE OR REPLACE VIEW public.businesses AS
SELECT * FROM pro.businesses;

-- Grant permissions on the view
GRANT SELECT ON public.businesses TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.businesses TO authenticated;

-- Create INSTEAD OF triggers to make the view updatable
CREATE OR REPLACE FUNCTION public.businesses_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pro.businesses (
    id, account_id, name, description, contact_name, email, phone, website,
    address, lat, lng, logo_url, status, onboarded, created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.account_id,
    NEW.name,
    NEW.description,
    NEW.contact_name,
    NEW.email,
    NEW.phone,
    NEW.website,
    NEW.address,
    NEW.lat,
    NEW.lng,
    NEW.logo_url,
    COALESCE(NEW.status, 'in_review'),
    COALESCE(NEW.onboarded, false),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.businesses_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pro.businesses SET
    account_id = NEW.account_id,
    name = NEW.name,
    description = NEW.description,
    contact_name = NEW.contact_name,
    email = NEW.email,
    phone = NEW.phone,
    website = NEW.website,
    address = NEW.address,
    lat = NEW.lat,
    lng = NEW.lng,
    logo_url = NEW.logo_url,
    status = NEW.status,
    onboarded = NEW.onboarded,
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.businesses_delete_trigger()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM pro.businesses WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER businesses_instead_of_insert
  INSTEAD OF INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.businesses_insert_trigger();

CREATE TRIGGER businesses_instead_of_update
  INSTEAD OF UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.businesses_update_trigger();

CREATE TRIGGER businesses_instead_of_delete
  INSTEAD OF DELETE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.businesses_delete_trigger();

-- ============================================================================
-- STEP 11: Update accounts RLS to exclude accounts with businesses
-- ============================================================================

-- Drop existing anonymous user policy
DROP POLICY IF EXISTS "Anonymous users can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Anonymous users can view accounts with public content" ON public.accounts;
DROP POLICY IF EXISTS "Anonymous users can view accounts with public mentions" ON public.accounts;

-- Create new policy that excludes accounts with businesses
CREATE POLICY "Anonymous users can view accounts"
  ON public.accounts
  FOR SELECT
  TO anon
  USING (
    -- Exclude accounts that have businesses
    NOT EXISTS (
      SELECT 1 FROM pro.businesses
      WHERE businesses.account_id = accounts.id
    )
  );

-- ============================================================================
-- STEP 12: Add comments
-- ============================================================================

COMMENT ON SCHEMA pro IS 'Pro schema for business and professional account features';
COMMENT ON TABLE pro.businesses IS 'Business accounts linked to accounts.id for business account management';
COMMENT ON COLUMN pro.businesses.account_id IS 'References accounts.id - the account that owns this business';
COMMENT ON COLUMN pro.businesses.name IS 'Business name';
COMMENT ON COLUMN pro.businesses.description IS 'Business description';
COMMENT ON COLUMN pro.businesses.contact_name IS 'Contact person name';
COMMENT ON COLUMN pro.businesses.email IS 'Business email address';
COMMENT ON COLUMN pro.businesses.phone IS 'Business phone number';
COMMENT ON COLUMN pro.businesses.website IS 'Business website URL';
COMMENT ON COLUMN pro.businesses.address IS 'Full business address';
COMMENT ON COLUMN pro.businesses.lat IS 'Business latitude coordinate';
COMMENT ON COLUMN pro.businesses.lng IS 'Business longitude coordinate';
COMMENT ON COLUMN pro.businesses.logo_url IS 'URL to business logo image';
COMMENT ON COLUMN pro.businesses.status IS 'Business account status: in_review or approved';
COMMENT ON COLUMN pro.businesses.onboarded IS 'Whether the business setup has been completed by the user';

COMMENT ON VIEW public.businesses IS 'Public view for Supabase client compatibility. Points to pro.businesses table.';

COMMENT ON POLICY "Anonymous users can view accounts" ON public.accounts IS 
  'Allows anonymous users to view accounts, excluding those with businesses. This ensures business accounts are not publicly visible.';
