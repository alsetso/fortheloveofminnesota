-- Fix guest account function permissions
-- Migration 220 dropped and recreated the function but didn't re-grant permissions

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_or_create_guest_account(TEXT, TEXT) TO anon, authenticated;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.get_or_create_guest_account(TEXT, TEXT) OWNER TO postgres;

-- Grant UPDATE permission to anon for accounts table (needed for function to update guest accounts)
-- Even though the function is SECURITY DEFINER, we need table-level GRANT for the role
GRANT UPDATE ON public.accounts TO anon;

-- Create UPDATE policy for anonymous users to update their own guest accounts
-- This allows the SECURITY DEFINER function to update guest accounts
CREATE POLICY "Anonymous users can update own guest account"
  ON public.accounts FOR UPDATE
  TO anon
  USING (
    user_id IS NULL
    AND guest_id IS NOT NULL
  )
  WITH CHECK (
    user_id IS NULL
    AND guest_id IS NOT NULL
  );

COMMENT ON POLICY "Anonymous users can update own guest account" ON public.accounts IS
  'Allows anonymous users to update their own guest accounts. Used by get_or_create_guest_account SECURITY DEFINER function.';

COMMENT ON FUNCTION public.get_or_create_guest_account IS
  'Gets or creates a guest account for anonymous users. Guest accounts have NULL user_id and are identified by guest_id (stored in local storage). Sets default guest image from Supabase storage. Returns account details as JSON (bypasses RLS via SECURITY DEFINER).';





