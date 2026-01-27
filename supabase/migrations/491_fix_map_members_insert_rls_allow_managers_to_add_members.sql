-- Fix map_members_insert RLS policy to allow managers/owners to add any member
-- Previously only allowed inserting your own account_id, but managers need to add other users

-- Drop existing policy
DROP POLICY IF EXISTS "map_members_insert" ON public.map_members;

-- Create new policy that allows:
-- 1. Users can join themselves (auto-approve public maps)
-- 2. Managers/owners can add any member (for approving requests)
CREATE POLICY "map_members_insert"
  ON public.map_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Case 1: User is joining themselves (auto-approve public maps)
      (
        account_id IN (
          SELECT id FROM public.accounts WHERE user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM public.map
          WHERE id = map_id
          AND visibility = 'public'
          AND is_active = true
          AND auto_approve_members = true
        )
      )
      -- Case 2: Manager/owner is adding any member (for approving requests)
      OR EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.user_id = auth.uid()
        AND (
          -- User is a manager/owner of this map
          public.is_map_manager(map_id, accounts.id)
          -- OR user is the map owner (via map.account_id)
          OR EXISTS (
            SELECT 1 FROM public.map
            WHERE map.id = map_id
            AND map.account_id = accounts.id
          )
        )
      )
    )
  );
