-- Fix map_membership_requests_update RLS policy to allow any account belonging to the authenticated user
-- Previously only allowed the first account (LIMIT 1), but users can switch accounts via dropdown

-- Drop existing policy
DROP POLICY IF EXISTS "map_membership_requests_update" ON public.map_membership_requests;

-- Create new policy that allows managers/owners to update requests (any account belonging to user)
CREATE POLICY "map_membership_requests_update"
  ON public.map_membership_requests FOR UPDATE
  TO authenticated
  USING (
    -- User is a manager/owner of this map (check all accounts belonging to user)
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.user_id = auth.uid()
      AND (
        -- User is a manager/owner via map_members
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
  WITH CHECK (
    -- Same check for WITH CHECK clause
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.user_id = auth.uid()
      AND (
        -- User is a manager/owner via map_members
        public.is_map_manager(map_id, accounts.id)
        -- OR user is the map owner (via map.account_id)
        OR EXISTS (
          SELECT 1 FROM public.map
          WHERE map.id = map_id
          AND map.account_id = accounts.id
        )
      )
    )
  );
