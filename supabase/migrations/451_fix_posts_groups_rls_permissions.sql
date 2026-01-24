-- Fix RLS permissions for posts and groups tables
-- Ensure proper access for anonymous and authenticated users

-- ============================================================================
-- STEP 1: Grant necessary permissions on posts table
-- ============================================================================

-- Grant SELECT to authenticated and anon roles
GRANT SELECT ON public.posts TO authenticated, anon;
GRANT INSERT ON public.posts TO authenticated;
GRANT UPDATE ON public.posts TO authenticated;
GRANT DELETE ON public.posts TO authenticated;

-- ============================================================================
-- STEP 2: Grant necessary permissions on groups table
-- ============================================================================

-- Grant SELECT to authenticated and anon roles
GRANT SELECT ON public.groups TO authenticated, anon;
GRANT INSERT ON public.groups TO authenticated;
GRANT UPDATE ON public.groups TO authenticated;
GRANT DELETE ON public.groups TO authenticated;

-- ============================================================================
-- STEP 3: Grant necessary permissions on group_members table
-- ============================================================================

-- Grant SELECT to authenticated (anon doesn't need access)
GRANT SELECT ON public.group_members TO authenticated;
GRANT INSERT ON public.group_members TO authenticated;
GRANT UPDATE ON public.group_members TO authenticated;
GRANT DELETE ON public.group_members TO authenticated;

-- ============================================================================
-- STEP 4: Ensure RLS is enabled
-- ============================================================================

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Verify and recreate posts policies if needed
-- ============================================================================

-- Drop and recreate posts policies to ensure they're correct
DROP POLICY IF EXISTS "posts_select_anon" ON public.posts;
DROP POLICY IF EXISTS "posts_select_authenticated" ON public.posts;
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
DROP POLICY IF EXISTS "posts_select_group_members" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_group" ON public.posts;

-- Anonymous: Can view public posts only
CREATE POLICY "posts_select_anon"
  ON public.posts FOR SELECT
  TO anon
  USING (visibility = 'public'::public.post_visibility);

-- Authenticated: Can view public posts and own posts (including drafts)
CREATE POLICY "posts_select_authenticated"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'::public.post_visibility OR
    public.user_owns_account(account_id)
  );

-- Authenticated: Can insert posts for own account
CREATE POLICY "posts_insert"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- Authenticated: Can update own posts
CREATE POLICY "posts_update"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (
    public.user_owns_account(account_id)
  )
  WITH CHECK (
    public.user_owns_account(account_id)
  );

-- Authenticated: Can delete own posts
CREATE POLICY "posts_delete"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    public.user_owns_account(account_id)
  );

-- Posts in groups: Visible to group members
CREATE POLICY "posts_select_group_members"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    group_id IS NOT NULL
    AND public.is_group_member(group_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Posts in groups: Members can create posts
CREATE POLICY "posts_insert_group"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IS NOT NULL
    AND public.is_group_member(group_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- ============================================================================
-- STEP 6: Verify and recreate groups policies if needed
-- ============================================================================

-- Drop and recreate groups policies
DROP POLICY IF EXISTS "groups_select_public" ON public.groups;
DROP POLICY IF EXISTS "groups_select_private_members" ON public.groups;
DROP POLICY IF EXISTS "groups_insert" ON public.groups;
DROP POLICY IF EXISTS "groups_update" ON public.groups;
DROP POLICY IF EXISTS "groups_delete" ON public.groups;

-- Groups: Public groups visible to everyone, private groups visible to members
CREATE POLICY "groups_select_public"
  ON public.groups FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'::public.group_visibility AND is_active = true
  );

CREATE POLICY "groups_select_private_members"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    visibility = 'private'::public.group_visibility
    AND is_active = true
    AND public.is_group_member(id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Groups: Authenticated users can create groups
CREATE POLICY "groups_insert"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by_account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Groups: Only admins can update
CREATE POLICY "groups_update"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (
    public.is_group_admin(id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Groups: Only admins can delete (soft delete via is_active)
CREATE POLICY "groups_delete"
  ON public.groups FOR DELETE
  TO authenticated
  USING (
    public.is_group_admin(id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- ============================================================================
-- STEP 7: Verify and recreate group_members policies if needed
-- ============================================================================

-- Drop and recreate group_members policies
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;

-- Group members: Visible to group members and admins
CREATE POLICY "group_members_select"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    public.is_group_member(group_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Group members: Users can join public groups, members can invite to private groups
CREATE POLICY "group_members_insert"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
    AND (
      -- Public groups: anyone can join
      EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = group_id
        AND visibility = 'public'::public.group_visibility
        AND is_active = true
      )
      -- Private groups: only if invited by admin (for now, we'll handle this in API)
      OR public.is_group_admin(group_id, (
        SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
      ))
    )
  );

-- Group members: Only admins can update (promote/demote)
CREATE POLICY "group_members_update"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (
    public.is_group_admin(group_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Group members: Users can leave, admins can remove
CREATE POLICY "group_members_delete"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    -- Users can leave themselves
    account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
    -- Or admins can remove members
    OR public.is_group_admin(group_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- ============================================================================
-- STEP 8: Grant execute permissions on helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.user_owns_account(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_group_admin(UUID, UUID) TO authenticated, anon;

-- ============================================================================
-- STEP 9: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
