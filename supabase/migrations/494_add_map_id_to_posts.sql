-- Add map_id to posts table
-- Aligns posts with map-centric architecture where maps are the global wrapper for functionality and permissions
-- Posts inherit map permissions and visibility, similar to map_pins and map_areas

-- ============================================================================
-- STEP 1: Add map_id column to posts table
-- ============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS map_id UUID REFERENCES public.map(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

-- Index for filtering posts by map
CREATE INDEX IF NOT EXISTS posts_map_id_idx 
  ON public.posts(map_id) 
  WHERE map_id IS NOT NULL;

-- Composite index for common queries: map posts by visibility and date
CREATE INDEX IF NOT EXISTS posts_map_id_visibility_created_idx 
  ON public.posts(map_id, visibility, created_at DESC) 
  WHERE map_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Add column comment
-- ============================================================================

COMMENT ON COLUMN public.posts.map_id IS 
  'Map this post belongs to. Nullable for backward compatibility. Posts inherit map permissions and visibility.';

-- ============================================================================
-- STEP 4: Update RLS policies to check map access
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "posts_select_anon" ON public.posts;
DROP POLICY IF EXISTS "posts_select_authenticated" ON public.posts;
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "posts_delete" ON public.posts;

-- ============================================================================
-- STEP 5: Create updated SELECT policies with map access checks
-- ============================================================================

-- Anonymous: Can view public posts only
-- If post has map_id, map must be public and active
CREATE POLICY "posts_select_anon"
  ON public.posts FOR SELECT
  TO anon
  USING (
    visibility = 'public'::public.post_visibility
    AND (
      map_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.map
        WHERE map.id = posts.map_id
        AND map.visibility = 'public'
        AND map.is_active = true
      )
    )
  );

-- Authenticated: Can view public posts and own posts (including drafts)
-- If post has map_id, check map access (public map OR map member)
CREATE POLICY "posts_select_authenticated"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    (
      -- Own posts (including drafts)
      public.user_owns_account(account_id)
    )
    OR (
      -- Public posts
      visibility = 'public'::public.post_visibility
      AND (
        -- No map (general post)
        map_id IS NULL
        OR (
          -- Map exists and is active
          EXISTS (
            SELECT 1 FROM public.map
            WHERE map.id = posts.map_id
            AND map.is_active = true
            AND (
              -- Public map: anyone can see
              map.visibility = 'public'
              OR
              -- Private map: must be member
              (
                map.visibility = 'private'
                AND public.is_map_member(
                  posts.map_id,
                  (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
                )
              )
            )
          )
        )
      )
    )
  );

-- ============================================================================
-- STEP 6: Create updated INSERT policy with map access validation
-- ============================================================================

-- Authenticated: Can insert posts for own account
-- If map_id is provided, validate map access and permissions
CREATE POLICY "posts_insert"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    -- Must own the account
    AND public.user_owns_account(account_id)
    -- If map_id provided, validate map access
    AND (
      map_id IS NULL
      OR (
        -- Map exists and is active
        EXISTS (
          SELECT 1 FROM public.map
          WHERE map.id = posts.map_id
          AND map.is_active = true
          AND (
            -- Public map: anyone can post if map allows it
            (
              map.visibility = 'public'
              AND COALESCE((map.settings->'collaboration'->>'allow_posts')::boolean, false) = true
            )
            OR
            -- Private map: must be member
            (
              map.visibility = 'private'
              AND public.is_map_member(
                posts.map_id,
                (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
              )
              AND COALESCE((map.settings->'collaboration'->>'allow_posts')::boolean, false) = true
            )
            OR
            -- Map owner/manager can always post (bypasses allow_posts setting)
            public.is_map_manager(
              posts.map_id,
              (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
            )
          )
        )
      )
    )
  );

-- ============================================================================
-- STEP 7: Create updated UPDATE policy with map access validation
-- ============================================================================

-- Authenticated: Can update own posts
-- If updating map_id, validate new map access
CREATE POLICY "posts_update"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (
    -- Must own the account
    public.user_owns_account(account_id)
    -- If post has map_id, verify user still has access
    AND (
      map_id IS NULL
      OR public.is_map_member(
        map_id,
        (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
      )
      OR public.user_owns_account(account_id)
    )
  )
  WITH CHECK (
    -- Must still own the account after update
    public.user_owns_account(account_id)
    -- If setting/updating map_id, validate map access (same as INSERT)
    AND (
      map_id IS NULL
      OR (
        EXISTS (
          SELECT 1 FROM public.map
          WHERE map.id = posts.map_id
          AND map.is_active = true
          AND (
            (
              map.visibility = 'public'
              AND COALESCE((map.settings->'collaboration'->>'allow_posts')::boolean, false) = true
            )
            OR
            (
              map.visibility = 'private'
              AND public.is_map_member(
                posts.map_id,
                (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
              )
              AND COALESCE((map.settings->'collaboration'->>'allow_posts')::boolean, false) = true
            )
            OR
            public.is_map_manager(
              posts.map_id,
              (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
            )
          )
        )
      )
    )
  );

-- ============================================================================
-- STEP 8: Create updated DELETE policy
-- ============================================================================

-- Authenticated: Can delete own posts
-- Map managers can also delete posts on their maps
CREATE POLICY "posts_delete"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    -- Own the post
    public.user_owns_account(account_id)
    OR
    -- Map manager can delete posts on their map
    (
      map_id IS NOT NULL
      AND public.is_map_manager(
        map_id,
        (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

-- ============================================================================
-- STEP 9: Add policy comments
-- ============================================================================

COMMENT ON POLICY "posts_select_anon" ON public.posts IS 
  'Anonymous users can view public posts. If post has map_id, map must be public and active.';

COMMENT ON POLICY "posts_select_authenticated" ON public.posts IS 
  'Authenticated users can view public posts and own posts. If post has map_id, checks map visibility and membership.';

COMMENT ON POLICY "posts_insert" ON public.posts IS 
  'Authenticated users can create posts for their own account. If map_id is provided, validates map access and collaboration settings (allow_posts).';

COMMENT ON POLICY "posts_update" ON public.posts IS 
  'Authenticated users can update their own posts. If updating map_id, validates map access.';

COMMENT ON POLICY "posts_delete" ON public.posts IS 
  'Authenticated users can delete their own posts. Map managers can also delete posts on their maps.';
