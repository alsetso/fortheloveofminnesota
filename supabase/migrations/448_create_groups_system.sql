-- Create groups system for public/private groups with admin control
-- Groups allow users to create communities similar to Facebook groups
-- Posts can reference groups and mentions

-- ============================================================================
-- STEP 1: Create group_visibility enum
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.group_visibility AS ENUM (
    'public',
    'private'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: Create groups table
-- ============================================================================

CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Group identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  image_url TEXT,
  
  -- Visibility and settings
  visibility public.group_visibility NOT NULL DEFAULT 'public'::public.group_visibility,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Ownership
  created_by_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  
  -- Metadata
  member_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT groups_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  CONSTRAINT groups_slug_length CHECK (char_length(slug) >= 1 AND char_length(slug) <= 100),
  CONSTRAINT groups_description_length CHECK (description IS NULL OR char_length(description) <= 1000),
  CONSTRAINT groups_member_count_non_negative CHECK (member_count >= 0),
  CONSTRAINT groups_post_count_non_negative CHECK (post_count >= 0)
);

-- ============================================================================
-- STEP 3: Create indexes for groups
-- ============================================================================

CREATE INDEX idx_groups_slug ON public.groups(slug);
CREATE INDEX idx_groups_created_by_account_id ON public.groups(created_by_account_id);
CREATE INDEX idx_groups_visibility ON public.groups(visibility);
CREATE INDEX idx_groups_is_active ON public.groups(is_active) WHERE is_active = true;
CREATE INDEX idx_groups_created_at ON public.groups(created_at DESC);
CREATE INDEX idx_groups_member_count ON public.groups(member_count DESC);

-- ============================================================================
-- STEP 4: Create group_members table
-- ============================================================================

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Member status
  is_admin BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(group_id, account_id)
);

-- ============================================================================
-- STEP 5: Create indexes for group_members
-- ============================================================================

CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_account_id ON public.group_members(account_id);
CREATE INDEX idx_group_members_is_admin ON public.group_members(is_admin) WHERE is_admin = true;
CREATE INDEX idx_group_members_joined_at ON public.group_members(joined_at DESC);

-- ============================================================================
-- STEP 5.5: Create helper functions (needed for RLS policies in steps 6 and 10)
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
-- STEP 6: Create posts table (if it doesn't exist) and add group/mention support
-- ============================================================================

-- Ensure post_visibility enum exists
DO $$ BEGIN
  CREATE TYPE public.post_visibility AS ENUM (
    'public',
    'draft'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Ensure user_owns_account function exists (needed for RLS)
CREATE OR REPLACE FUNCTION public.user_owns_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER runs with postgres privileges, bypassing RLS
  -- This allows us to check account ownership even if accounts table has RLS
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = user_owns_account.account_id
    AND accounts.user_id = auth.uid()
  );
END;
$$;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.user_owns_account(UUID) OWNER TO postgres;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_owns_account(UUID) TO authenticated, anon;

-- Create posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  visibility public.post_visibility NOT NULL DEFAULT 'public'::public.post_visibility,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT posts_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  CONSTRAINT posts_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 10000)
);

-- Add group_id column (for posts belonging to groups)
-- Note: groups table exists from step 2, so this foreign key reference is safe
DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.posts
      ADD COLUMN group_id UUID;
  END IF;
  
  -- Add foreign key constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'posts_group_id_fkey'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_group_id_fkey 
      FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add mention_ids JSONB array (for referencing mentions in posts)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS mention_ids JSONB DEFAULT '[]'::jsonb;

-- Add optional columns that might be useful for posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS map_data JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS posts_account_id_idx ON public.posts(account_id);
CREATE INDEX IF NOT EXISTS posts_visibility_idx ON public.posts(visibility);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_group_id ON public.posts(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_mention_ids ON public.posts USING GIN (mention_ids) WHERE mention_ids IS NOT NULL AND jsonb_array_length(mention_ids) > 0;
CREATE INDEX IF NOT EXISTS posts_images_idx ON public.posts USING GIN (images) WHERE images IS NOT NULL AND jsonb_array_length(images) > 0;
CREATE INDEX IF NOT EXISTS posts_map_data_idx ON public.posts USING GIN (map_data) WHERE map_data IS NOT NULL;

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
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

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_posts_updated_at();

-- ============================================================================
-- STEP 7: Create additional helper functions for groups
-- ============================================================================

-- Note: is_group_member and is_group_admin are already created in step 6
-- This section is for any additional group-related functions if needed

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
CREATE TRIGGER update_group_member_count_trigger
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_member_count();

-- Trigger to update group post count
CREATE TRIGGER update_group_post_count_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_post_count();

-- Trigger to update groups.updated_at
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 9: Enable RLS
-- ============================================================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 10: Create RLS policies for groups
-- ============================================================================

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
-- STEP 12: Update posts RLS to handle groups
-- ============================================================================

-- Drop existing posts policies if they exist (we'll recreate them)
DROP POLICY IF EXISTS "posts_select_group_members" ON public.posts;

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
DROP POLICY IF EXISTS "posts_insert_group" ON public.posts;
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

-- ============================================================================
-- STEP 15: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
