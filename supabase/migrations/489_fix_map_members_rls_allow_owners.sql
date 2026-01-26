-- Fix map_members RLS to allow map owners to view members
-- Even if they're not in map_members table (edge case)

-- Drop existing policy
DROP POLICY IF EXISTS "map_members_select" ON public.map_members;

-- Create new policy that allows:
-- 1. Map members (via is_map_member function)
-- 2. Map owners (via map.account_id check)
CREATE POLICY "map_members_select"
  ON public.map_members FOR SELECT
  TO authenticated
  USING (
    -- User is a member
    public.is_map_member(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
    -- OR user is the map owner
    OR EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_members.map_id
      AND map.account_id = (
        SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );
