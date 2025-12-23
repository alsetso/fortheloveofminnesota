-- Recreate accounts table with complete schema
-- Includes all fields from Account interface, signup functions, triggers, and RLS

-- ============================================================================
-- STEP 1: Create enums
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
-- STEP 2: Create helper functions
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

-- User owns account helper function (CRITICAL for RLS in other tables)
-- SECURITY DEFINER allows bypassing RLS on accounts table
CREATE OR REPLACE FUNCTION public.user_owns_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Return false immediately if no authenticated user (handles anonymous users)
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- SECURITY DEFINER runs with postgres privileges, bypassing RLS
  -- This allows us to check account ownership even if accounts table has RLS
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = account_id
    AND accounts.user_id = auth.uid()
  );
END;
$$;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.user_owns_account(UUID) OWNER TO postgres;

-- Grant execute permission to both authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.user_owns_account(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.user_owns_account(UUID) IS
  'Helper function to check if the current user owns an account. Used extensively in RLS policies for pins, posts, maps, etc. SECURITY DEFINER bypasses RLS on accounts table.';

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
-- STEP 3: Create accounts table
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
  CONSTRAINT accounts_view_count_non_negative CHECK (view_count >= 0),
  CONSTRAINT accounts_username_unique UNIQUE (username) -- Username must be unique if set
);

-- ============================================================================
-- STEP 4: Create indexes
-- ============================================================================

-- Core lookup indexes
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_accounts_username ON public.accounts(username) WHERE username IS NOT NULL;
CREATE INDEX idx_accounts_guest_id ON public.accounts(guest_id) WHERE guest_id IS NOT NULL;

-- Role and permissions
CREATE INDEX idx_accounts_role ON public.accounts(role);

-- Personal info (for search/lookup)
CREATE INDEX idx_accounts_first_name ON public.accounts(first_name) WHERE first_name IS NOT NULL;
CREATE INDEX idx_accounts_last_name ON public.accounts(last_name) WHERE last_name IS NOT NULL;
CREATE INDEX idx_accounts_email ON public.accounts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_accounts_phone ON public.accounts(phone) WHERE phone IS NOT NULL;

-- Location
CREATE INDEX idx_accounts_city_id ON public.accounts(city_id) WHERE city_id IS NOT NULL;

-- Billing
CREATE INDEX idx_accounts_stripe_customer_id ON public.accounts(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_accounts_stripe_subscription_id ON public.accounts(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_accounts_plan ON public.accounts(plan);
CREATE INDEX idx_accounts_billing_mode ON public.accounts(billing_mode);
CREATE INDEX idx_accounts_subscription_status ON public.accounts(subscription_status) WHERE subscription_status IS NOT NULL;

-- Analytics
CREATE INDEX idx_accounts_view_count ON public.accounts(view_count DESC) WHERE view_count > 0;

-- Traits array (GIN index for array operations)
CREATE INDEX accounts_traits_idx ON public.accounts USING GIN (traits) WHERE traits IS NOT NULL AND array_length(traits, 1) > 0;

-- Composite index for RLS performance (user_id + role for is_admin checks)
CREATE INDEX idx_accounts_user_id_role ON public.accounts(user_id, role) WHERE user_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Create triggers
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
-- STEP 6: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS policies
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

-- Anonymous users can view accounts (for public profiles, guest accounts, etc.)
-- This enables displaying account info in pins, posts, etc.
CREATE POLICY "Anonymous users can view accounts"
  ON public.accounts
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounts TO anon;

-- ============================================================================
-- STEP 9: Add comments
-- ============================================================================

COMMENT ON TABLE public.accounts IS 
  'User accounts table. Extends auth.users with profile information. Supports both authenticated users (user_id) and guest accounts (guest_id).';

COMMENT ON COLUMN public.accounts.id IS 'Unique account ID (UUID)';
COMMENT ON COLUMN public.accounts.user_id IS 'References auth.users(id) - nullable for guest accounts';
COMMENT ON COLUMN public.accounts.username IS 'Unique username for the account (must be unique if set)';
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


