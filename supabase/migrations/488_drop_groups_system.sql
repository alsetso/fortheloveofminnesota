-- Drop entire groups system
-- This migration removes all groups-related database objects

-- ============================================================================
-- STEP 1: Drop triggers first (they depend on functions)
-- ============================================================================

DROP TRIGGER IF EXISTS update_group_member_count_trigger ON public.group_members;
DROP TRIGGER IF EXISTS update_group_post_count_trigger ON public.posts;
DROP TRIGGER IF EXISTS update_groups_updated_at ON public.groups;
DROP TRIGGER IF EXISTS auto_add_group_creator_as_admin_trigger ON public.groups;
DROP TRIGGER IF EXISTS handle_approved_group_request_trigger ON public.group_requests;
DROP TRIGGER IF EXISTS update_group_requests_updated_at ON public.group_requests;

-- ============================================================================
-- STEP 2: Drop RLS policies
-- ============================================================================

-- Drop group_requests policies
DROP POLICY IF EXISTS "group_requests_select_own" ON public.group_requests;
DROP POLICY IF EXISTS "group_requests_select_admin" ON public.group_requests;
DROP POLICY IF EXISTS "group_requests_insert" ON public.group_requests;
DROP POLICY IF EXISTS "group_requests_update" ON public.group_requests;
DROP POLICY IF EXISTS "group_requests_delete_own" ON public.group_requests;

-- Drop group_members policies
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;

-- Drop groups policies
DROP POLICY IF EXISTS "groups_select_public" ON public.groups;
DROP POLICY IF EXISTS "groups_select_private" ON public.groups;
DROP POLICY IF EXISTS "groups_select_private_members" ON public.groups;
DROP POLICY IF EXISTS "groups_insert" ON public.groups;
DROP POLICY IF EXISTS "groups_update" ON public.groups;
DROP POLICY IF EXISTS "groups_delete" ON public.groups;

-- Drop posts policies related to groups
DROP POLICY IF EXISTS "posts_select_group_members" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_group" ON public.posts;

-- ============================================================================
-- STEP 3: Drop functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.handle_approved_group_request() CASCADE;
DROP FUNCTION IF EXISTS public.auto_add_group_creator_as_admin() CASCADE;
DROP FUNCTION IF EXISTS public.update_group_post_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_group_member_count() CASCADE;
DROP FUNCTION IF EXISTS public.is_group_admin(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_member(UUID, UUID) CASCADE;

-- ============================================================================
-- STEP 4: Drop indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_groups_slug;
DROP INDEX IF EXISTS public.idx_groups_created_by_account_id;
DROP INDEX IF EXISTS public.idx_groups_visibility;
DROP INDEX IF EXISTS public.idx_groups_is_active;
DROP INDEX IF EXISTS public.idx_groups_created_at;
DROP INDEX IF EXISTS public.idx_groups_member_count;
DROP INDEX IF EXISTS public.idx_group_members_group_id;
DROP INDEX IF EXISTS public.idx_group_members_account_id;
DROP INDEX IF EXISTS public.idx_group_members_is_admin;
DROP INDEX IF EXISTS public.idx_group_members_joined_at;
DROP INDEX IF EXISTS public.idx_group_requests_group_id;
DROP INDEX IF EXISTS public.idx_group_requests_account_id;
DROP INDEX IF EXISTS public.idx_group_requests_status;
DROP INDEX IF EXISTS public.idx_group_requests_created_at;
DROP INDEX IF EXISTS public.idx_posts_group_id;

-- ============================================================================
-- STEP 5: Remove group_id column from posts table
-- ============================================================================

-- First, set all group_id values to NULL
UPDATE public.posts SET group_id = NULL WHERE group_id IS NOT NULL;

-- Drop foreign key constraint
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_group_id_fkey;

-- Drop the column
ALTER TABLE public.posts DROP COLUMN IF EXISTS group_id;

-- ============================================================================
-- STEP 6: Drop tables (order matters due to foreign keys)
-- ============================================================================

DROP TABLE IF EXISTS public.group_requests CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;

-- ============================================================================
-- STEP 7: Drop enum type
-- ============================================================================

DROP TYPE IF EXISTS public.group_visibility CASCADE;

-- ============================================================================
-- STEP 8: Revoke grants
-- ============================================================================

REVOKE ALL ON public.groups FROM authenticated, anon;
REVOKE ALL ON public.group_members FROM authenticated, anon;
REVOKE ALL ON public.group_requests FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(UUID, UUID) FROM authenticated, anon;

-- ============================================================================
-- STEP 9: Remove groups feature from billing system
-- ============================================================================

-- Remove groups feature from plan_features
DELETE FROM billing.plan_features
WHERE feature_id IN (
  SELECT id FROM billing.features WHERE slug = 'groups'
);

-- Remove groups feature limits (if any exist in plan_features)
UPDATE billing.plan_features
SET limit_value = NULL, limit_type = NULL
WHERE feature_id IN (
  SELECT id FROM billing.features WHERE slug = 'groups'
);

-- Remove groups feature from features table
DELETE FROM billing.features WHERE slug = 'groups';

-- ============================================================================
-- STEP 10: Drop storage bucket and policies
-- ============================================================================

-- Drop storage policies
DROP POLICY IF EXISTS "Group admins can upload group images" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can update group images" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can delete group images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view group images" ON storage.objects;

-- Drop storage bucket (note: this may fail if bucket has files - delete files first via dashboard)
-- Uncomment if you want to delete the bucket (requires manual cleanup of files first)
-- DELETE FROM storage.buckets WHERE id = 'group-images';

-- ============================================================================
-- STEP 11: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- STEP 12: Add comments
-- ============================================================================

COMMENT ON TABLE public.posts IS 'Posts table - group_id column has been removed';
