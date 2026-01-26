-- Fix RLS policies to allow any account belonging to the authenticated user
-- Previously only allowed the first account (LIMIT 1), but users can switch accounts via dropdown

-- ============================================================================
-- Fix map_membership_requests RLS
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "map_membership_requests_insert" ON public.map_membership_requests;

-- Create new policy that allows any account belonging to the authenticated user
CREATE POLICY "map_membership_requests_insert"
  ON public.map_membership_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
    AND NOT EXISTS (
      -- Can't request if already a member
      SELECT 1 FROM public.map_members
      WHERE map_members.map_id = map_membership_requests.map_id
      AND map_members.account_id = map_membership_requests.account_id
    )
    AND (
      -- Public maps without auto-approve
      EXISTS (
        SELECT 1 FROM public.map
        WHERE id = map_id
        AND visibility = 'public'
        AND is_active = true
        AND auto_approve_members = false
      )
      -- Private maps (requires invitation, but allow request)
      OR EXISTS (
        SELECT 1 FROM public.map
        WHERE id = map_id
        AND visibility = 'private'
        AND is_active = true
      )
    )
  );

-- ============================================================================
-- Fix map_members RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "map_members_select" ON public.map_members;
DROP POLICY IF EXISTS "map_members_insert" ON public.map_members;
DROP POLICY IF EXISTS "map_members_update" ON public.map_members;
DROP POLICY IF EXISTS "map_members_delete" ON public.map_members;

-- Policy: Members can view other members (any account belonging to user)
CREATE POLICY "map_members_select"
  ON public.map_members FOR SELECT
  TO authenticated
  USING (
    -- User is a member of this map (check all accounts belonging to user)
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.user_id = auth.uid()
      AND public.is_map_member(map_members.map_id, accounts.id)
    )
    -- OR user is the map owner (check all accounts belonging to user)
    OR EXISTS (
      SELECT 1 FROM public.map
      INNER JOIN public.accounts ON accounts.id = map.account_id
      WHERE map.id = map_members.map_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Policy: Auto-approve public maps: anyone can join (any account belonging to user)
-- Manual approval: only managers can add members
CREATE POLICY "map_members_insert"
  ON public.map_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
    AND (
      -- Public maps with auto-approve: anyone can join
      EXISTS (
        SELECT 1 FROM public.map
        WHERE id = map_id
        AND visibility = 'public'
        AND is_active = true
        AND auto_approve_members = true
      )
      -- Private maps or manual approval: only managers can add
      OR EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.user_id = auth.uid()
        AND accounts.id = account_id
        AND public.is_map_manager(map_id, accounts.id)
      )
    )
  );

-- Policy: Only managers can update member roles (any account belonging to user)
CREATE POLICY "map_members_update"
  ON public.map_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.user_id = auth.uid()
      AND public.is_map_manager(map_id, accounts.id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.user_id = auth.uid()
      AND public.is_map_manager(map_id, accounts.id)
    )
  );

-- Policy: Users can leave, managers can remove (any account belonging to user)
CREATE POLICY "map_members_delete"
  ON public.map_members FOR DELETE
  TO authenticated
  USING (
    -- Users can leave themselves (any account belonging to user)
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
    -- Or managers can remove members (but not owners)
    OR (
      EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.user_id = auth.uid()
        AND public.is_map_manager(map_id, accounts.id)
      )
      AND role != 'owner'
    )
  );
