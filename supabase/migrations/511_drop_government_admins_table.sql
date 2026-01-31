-- Drop government_admins table and all related objects from public schema
-- Update accounts RLS to remove government_admins exclusion

-- ============================================================================
-- STEP 1: Drop all triggers on government_admins table
-- ============================================================================

DROP TRIGGER IF EXISTS update_government_admins_updated_at ON public.government_admins;
DROP TRIGGER IF EXISTS check_government_admins_account_limit_trigger ON public.government_admins;
DROP TRIGGER IF EXISTS prevent_government_admin_status_change_trigger ON public.government_admins;

-- ============================================================================
-- STEP 2: Drop all RLS policies on government_admins table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own government admins" ON public.government_admins;
DROP POLICY IF EXISTS "Users can insert own government admins" ON public.government_admins;
DROP POLICY IF EXISTS "Users can update own government admins" ON public.government_admins;
DROP POLICY IF EXISTS "Users can delete own government admins" ON public.government_admins;
DROP POLICY IF EXISTS "Public can view approved government admins" ON public.government_admins;
DROP POLICY IF EXISTS "Admins can view all government admins" ON public.government_admins;
DROP POLICY IF EXISTS "Admins can update all government admins" ON public.government_admins;
DROP POLICY IF EXISTS "Admins can insert government admins" ON public.government_admins;
DROP POLICY IF EXISTS "Admins can delete all government admins" ON public.government_admins;

-- ============================================================================
-- STEP 3: Revoke permissions on government_admins table
-- ============================================================================

REVOKE ALL ON public.government_admins FROM authenticated, anon;

-- ============================================================================
-- STEP 4: Drop government_admins table (CASCADE will drop indexes automatically)
-- ============================================================================

DROP TABLE IF EXISTS public.government_admins CASCADE;

-- ============================================================================
-- STEP 5: Drop functions related to government_admins
-- ============================================================================

DROP FUNCTION IF EXISTS public.check_government_admins_account_limit() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_government_admin_status_change_by_user() CASCADE;

-- ============================================================================
-- STEP 6: Update accounts RLS to remove government_admins exclusion
-- ============================================================================

-- Drop existing anonymous user policy
DROP POLICY IF EXISTS "Anonymous users can view accounts" ON public.accounts;

-- Create new policy that only excludes accounts with businesses (no government_admins check)
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
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON POLICY "Anonymous users can view accounts" ON public.accounts IS 
  'Allows anonymous users to view accounts, excluding those with businesses. Business accounts are not publicly visible.';
