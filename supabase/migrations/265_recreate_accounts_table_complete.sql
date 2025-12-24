-- Drop profiles table and recreate accounts table with complete schema
-- Includes all fields from Account interface and signup functions/triggers

-- ============================================================================
-- STEP 1: Drop profiles table and dependent objects
-- ============================================================================

DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop existing accounts table if it exists
DROP TABLE IF EXISTS public.accounts CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- ============================================================================
-- STEP 2: Create enums
-- ============================================================================

-- Account role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_role') THEN
    CREATE TYPE public.account_role AS ENUM ('general', 'admin');
  END IF;
END $$;

-- Account trait enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_trait') THEN
    CREATE TYPE public.account_trait AS ENUM (
      'homeowner',
      'buyer',
      'investor',
      'realtor',
      'wholesaler',
      'lender',
      'title',
      'renter',
      'businessowner'
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create helper functions
-- ============================================================================

-- Update updated_at column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Is admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.user_id = auth.uid()
    AND accounts.role = 'admin'::public.account_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_admin() IS 
  'Checks if the current authenticated user has admin role in accounts table.';

-- Handle new user function (creates account on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only insert if account doesn't already exist for this user
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = NEW.id) THEN
    INSERT INTO public.accounts (user_id, role, last_visit)
    VALUES (
      NEW.id,
      'general'::public.account_role,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS 
  'Creates minimal account record for new user. Email is in auth.users.';

-- ============================================================================
-- STEP 4: Create accounts table
-- ============================================================================

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Nullable for guest accounts
  
  -- Personal information
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  image_url TEXT,
  cover_image_url TEXT,
  bio TEXT CHECK (bio IS NULL OR char_length(bio) <= 220),
  
  -- Location
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  
  -- Account settings
  role public.account_role NOT NULL DEFAULT 'general'::public.account_role,
  traits public.account_trait[] DEFAULT '{}',
  view_count INTEGER NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  
  -- Billing
  stripe_customer_id TEXT,
  plan TEXT DEFAULT 'hobby' CHECK (plan IN ('hobby', 'pro', 'plus')),
  billing_mode TEXT DEFAULT 'standard' CHECK (billing_mode IN ('standard', 'trial')),
  subscription_status TEXT,
  stripe_subscription_id TEXT,
  
  -- Guest accounts
  guest_id TEXT UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_visit TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT accounts_user_or_guest_check CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL),
  CONSTRAINT accounts_view_count_non_negative CHECK (view_count >= 0)
);

-- ============================================================================
-- STEP 5: Create indexes
-- ============================================================================

CREATE INDEX idx_accounts_user_id ON public.accounts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_accounts_username ON public.accounts(username) WHERE username IS NOT NULL;
CREATE INDEX idx_accounts_role ON public.accounts(role);
CREATE INDEX idx_accounts_stripe_customer_id ON public.accounts(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_accounts_first_name ON public.accounts(first_name) WHERE first_name IS NOT NULL;
CREATE INDEX idx_accounts_last_name ON public.accounts(last_name) WHERE last_name IS NOT NULL;
CREATE INDEX idx_accounts_email ON public.accounts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_accounts_phone ON public.accounts(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_accounts_city_id ON public.accounts(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX idx_accounts_view_count ON public.accounts(view_count DESC) WHERE view_count > 0;
CREATE INDEX idx_accounts_guest_id ON public.accounts(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX idx_accounts_plan ON public.accounts(plan);
CREATE INDEX idx_accounts_billing_mode ON public.accounts(billing_mode);
CREATE INDEX idx_accounts_subscription_status ON public.accounts(subscription_status) WHERE subscription_status IS NOT NULL;
CREATE INDEX idx_accounts_stripe_subscription_id ON public.accounts(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX accounts_traits_idx ON public.accounts USING GIN (traits) WHERE traits IS NOT NULL AND array_length(traits, 1) > 0;

-- ============================================================================
-- STEP 6: Create triggers
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER update_accounts_updated_at 
    BEFORE UPDATE ON public.accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create account on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 7: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: Create RLS policies
-- ============================================================================

-- Users can view their own account
CREATE POLICY "Users can view own account"
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own account
CREATE POLICY "Users can update own account"
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can insert their own account
CREATE POLICY "Users can insert own account"
  ON public.accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can view all accounts
CREATE POLICY "Admins can view all accounts"
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all accounts
CREATE POLICY "Admins can update all accounts"
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can insert accounts
CREATE POLICY "Admins can insert accounts"
  ON public.accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Anonymous users can view accounts with public content (for guest accounts and public profiles)
CREATE POLICY "Anonymous users can view accounts with public content"
  ON public.accounts
  FOR SELECT
  TO anon
  USING (true); -- Allow viewing basic account info for public profiles

-- ============================================================================
-- STEP 9: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounts TO anon;

-- ============================================================================
-- STEP 10: Add comments
-- ============================================================================

COMMENT ON TABLE public.accounts IS 
  'User accounts table. Extends auth.users with profile information. Supports both authenticated users (user_id) and guest accounts (guest_id).';

COMMENT ON COLUMN public.accounts.id IS 'Unique account ID (UUID)';
COMMENT ON COLUMN public.accounts.user_id IS 'References auth.users(id) - nullable for guest accounts';
COMMENT ON COLUMN public.accounts.username IS 'Unique username for the account';
COMMENT ON COLUMN public.accounts.first_name IS 'User first name';
COMMENT ON COLUMN public.accounts.last_name IS 'User last name';
COMMENT ON COLUMN public.accounts.email IS 'Account email (editable, separate from auth.users.email)';
COMMENT ON COLUMN public.accounts.phone IS 'Account phone number';
COMMENT ON COLUMN public.accounts.image_url IS 'URL to user profile image';
COMMENT ON COLUMN public.accounts.cover_image_url IS 'URL to account cover/banner image';
COMMENT ON COLUMN public.accounts.bio IS 'User bio/description, maximum 220 characters';
COMMENT ON COLUMN public.accounts.city_id IS 'Primary city location (references atlas.cities)';
COMMENT ON COLUMN public.accounts.role IS 'Account role: general or admin';
COMMENT ON COLUMN public.accounts.traits IS 'Array of account traits (homeowner, buyer, investor, etc.)';
COMMENT ON COLUMN public.accounts.view_count IS 'Total number of profile views';
COMMENT ON COLUMN public.accounts.onboarded IS 'Whether user has completed onboarding';
COMMENT ON COLUMN public.accounts.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN public.accounts.plan IS 'Account plan: hobby, pro, or plus';
COMMENT ON COLUMN public.accounts.billing_mode IS 'Billing mode: standard or trial';
COMMENT ON COLUMN public.accounts.subscription_status IS 'Stripe subscription status';
COMMENT ON COLUMN public.accounts.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN public.accounts.guest_id IS 'Unique ID for guest accounts (stored in local storage)';
COMMENT ON COLUMN public.accounts.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN public.accounts.updated_at IS 'Last update timestamp (auto-updated)';
COMMENT ON COLUMN public.accounts.last_visit IS 'Last visit timestamp';



