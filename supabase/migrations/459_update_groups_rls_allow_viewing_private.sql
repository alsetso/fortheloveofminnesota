-- Update groups RLS to allow viewing private groups (but not joining)
-- Private groups should be searchable/visible but require join requests

-- ============================================================================
-- STEP 1: Update RLS policies to allow viewing private groups
-- ============================================================================

-- Drop existing select policies
DROP POLICY IF EXISTS "groups_select_public" ON public.groups;
DROP POLICY IF EXISTS "groups_select_private_members" ON public.groups;

-- Public groups: visible to everyone
CREATE POLICY "groups_select_public"
  ON public.groups FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'::public.group_visibility AND is_active = true
  );

-- Private groups: visible to everyone (for search/discovery), but joining requires request
-- This allows private groups to be searchable but not directly joinable
CREATE POLICY "groups_select_private"
  ON public.groups FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'private'::public.group_visibility AND is_active = true
  );

-- ============================================================================
-- STEP 2: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
