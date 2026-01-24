-- Complete groups system setup
-- This migration completes the remaining steps from 448_create_groups_system.sql
-- Assumes steps 1-6 of 448 have already been run

-- ============================================================================
-- STEP 0: Ensure helper functions exist (from step 5.5 of 448)
-- ============================================================================

-- Function to check if user is a group member
CREATE OR REPLACE FUNCTION public.is_group_member(group_id UUID, account_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_members.group_id = is_group_member.group_id
      AND group_members.account_id = is_group_member.account_id
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to check if user is a group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(group_id UUID, account_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_members.group_id = is_group_admin.group_id
      AND group_members.account_id = is_group_admin.account_id
      AND group_members.is_admin = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- STEP 7: Create helper functions for group counts
-- ============================================================================

-- Function to update group member count
CREATE OR REPLACE FUNCTION public.update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups
    SET member_count = member_count + 1
    WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups
    SET member_count = GREATEST(0, member_count - 1)
    WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update group post count
CREATE OR REPLACE FUNCTION public.update_group_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.group_id IS NOT NULL THEN
    UPDATE public.groups
    SET post_count = post_count + 1
    WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.group_id IS NOT NULL THEN
    UPDATE public.groups
    SET post_count = GREATEST(0, post_count - 1)
    WHERE id = OLD.group_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle group_id changes
    IF OLD.group_id IS DISTINCT FROM NEW.group_id THEN
      IF OLD.group_id IS NOT NULL THEN
        UPDATE public.groups
        SET post_count = GREATEST(0, post_count - 1)
        WHERE id = OLD.group_id;
      END IF;
      IF NEW.group_id IS NOT NULL THEN
        UPDATE public.groups
        SET post_count = post_count + 1
        WHERE id = NEW.group_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 8: Create triggers
-- ============================================================================

-- Trigger to update group member count
DROP TRIGGER IF EXISTS update_group_member_count_trigger ON public.group_members;
CREATE TRIGGER update_group_member_count_trigger
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_member_count();

-- Trigger to update group post count
DROP TRIGGER IF EXISTS update_group_post_count_trigger ON public.posts;
CREATE TRIGGER update_group_post_count_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_post_count();

-- Trigger to update groups.updated_at
DROP TRIGGER IF EXISTS update_groups_updated_at ON public.groups;
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 9: Enable RLS (if not already enabled)
-- ============================================================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 10: Create RLS policies for groups
-- ============================================================================

-- Drop existing policies if they exist
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
-- STEP 11: Create RLS policies for group_members
-- ============================================================================

-- Drop existing policies if they exist
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
-- STEP 12: Ensure posts RLS policies for groups are in place
-- ============================================================================

-- Note: These policies should already exist from step 6 of 448
-- We'll drop and recreate them to ensure they're correct

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "posts_select_group_members" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_group" ON public.posts;

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
-- STEP 13: Auto-add creator as admin member
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_add_group_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.group_members (group_id, account_id, is_admin)
  VALUES (NEW.id, NEW.created_by_account_id, true)
  ON CONFLICT (group_id, account_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_add_group_creator_as_admin_trigger ON public.groups;
CREATE TRIGGER auto_add_group_creator_as_admin_trigger
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_group_creator_as_admin();

-- ============================================================================
-- STEP 14: Add comments
-- ============================================================================

COMMENT ON TABLE public.groups IS 'Groups for community organization, similar to Facebook groups';
COMMENT ON TABLE public.group_members IS 'Membership and admin status for groups';
COMMENT ON COLUMN public.groups.visibility IS 'public: visible to everyone, private: visible to members only';
COMMENT ON COLUMN public.posts.group_id IS 'Group this post belongs to (null for feed posts)';
COMMENT ON COLUMN public.posts.mention_ids IS 'Array of mention UUIDs referenced in this post';
COMMENT ON FUNCTION public.is_group_member IS 'Check if an account is a member of a group';
COMMENT ON FUNCTION public.is_group_admin IS 'Check if an account is an admin of a group';
COMMENT ON FUNCTION public.update_group_member_count IS 'Trigger function to update group member_count when members are added/removed';
COMMENT ON FUNCTION public.update_group_post_count IS 'Trigger function to update group post_count when posts are created/deleted';
COMMENT ON FUNCTION public.auto_add_group_creator_as_admin IS 'Trigger function to automatically add group creator as admin member';

-- ============================================================================
-- STEP 15: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
