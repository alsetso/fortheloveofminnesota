# Groups Feature Deletion Checklist

Complete list of all groups-related features, files, backend tables, and code that needs to be removed.

## Database Tables & Schema

### Tables to DROP
1. `public.group_requests` - Join requests for private groups
2. `public.group_members` - Membership and admin status for groups
3. `public.groups` - Main groups table

### Enum Types to DROP
1. `public.group_visibility` - ENUM('public', 'private')

### Columns to REMOVE from existing tables
1. `public.posts.group_id` - Foreign key column referencing groups
2. `public.posts.idx_posts_group_id` - Index on posts.group_id

### Functions to DROP
1. `public.is_group_member(group_id UUID, account_id UUID)` - Check if account is member
2. `public.is_group_admin(group_id UUID, account_id UUID)` - Check if account is admin
3. `public.update_group_member_count()` - Trigger function for member count
4. `public.update_group_post_count()` - Trigger function for post count
5. `public.auto_add_group_creator_as_admin()` - Auto-add creator as admin
6. `public.handle_approved_group_request()` - Auto-add member when request approved

### Triggers to DROP
1. `update_group_member_count_trigger` on `public.group_members`
2. `update_group_post_count_trigger` on `public.posts`
3. `update_groups_updated_at` on `public.groups`
4. `auto_add_group_creator_as_admin_trigger` on `public.groups`
5. `handle_approved_group_request_trigger` on `public.group_requests`
6. `update_group_requests_updated_at` on `public.group_requests`

### RLS Policies to DROP
**Groups table:**
- `groups_select_public`
- `groups_select_private` (or `groups_select_private_members`)
- `groups_insert`
- `groups_update`
- `groups_delete`

**Group members table:**
- `group_members_select`
- `group_members_insert`
- `group_members_update`
- `group_members_delete`

**Group requests table:**
- `group_requests_select_own`
- `group_requests_select_admin`
- `group_requests_insert`
- `group_requests_update`
- `group_requests_delete_own`

**Posts table (group-related policies):**
- `posts_select_group_members`
- `posts_insert_group`

### Indexes to DROP
1. `idx_groups_slug` on `public.groups`
2. `idx_groups_created_by_account_id` on `public.groups`
3. `idx_groups_visibility` on `public.groups`
4. `idx_groups_is_active` on `public.groups`
5. `idx_groups_created_at` on `public.groups`
6. `idx_groups_member_count` on `public.groups`
7. `idx_group_members_group_id` on `public.group_members`
8. `idx_group_members_account_id` on `public.group_members`
9. `idx_group_members_is_admin` on `public.group_members`
10. `idx_group_members_joined_at` on `public.group_members`
11. `idx_group_requests_group_id` on `public.group_requests`
12. `idx_group_requests_account_id` on `public.group_requests`
13. `idx_group_requests_status` on `public.group_requests`
14. `idx_group_requests_created_at` on `public.group_requests`
15. `idx_posts_group_id` on `public.posts` (if exists)

### Storage Buckets to DROP
1. `group-images` - Storage bucket for group profile/cover images

### Storage Policies to DROP
1. `Group admins can upload group images`
2. `Group admins can update group images`
3. `Group admins can delete group images`
4. `Public can view group images`

### Billing Features to REMOVE
1. Remove `'groups'` feature from `billing.features` table
2. Remove all `billing.plan_features` entries linking plans to groups feature
3. Remove groups feature limits from `billing.plan_features` (in migration 475)

### Grants to REVOKE
1. `GRANT SELECT/INSERT/UPDATE/DELETE ON public.groups` - Remove grants
2. `GRANT SELECT/INSERT/UPDATE/DELETE ON public.group_members` - Remove grants
3. `GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID)` - Remove grants
4. `GRANT EXECUTE ON FUNCTION public.is_group_admin(UUID, UUID)` - Remove grants

## Migration Files to DELETE

1. `supabase/migrations/448_create_groups_system.sql`
2. `supabase/migrations/449_add_groups_billing_feature.sql`
3. `supabase/migrations/450_complete_groups_system.sql`
4. `supabase/migrations/451_fix_posts_groups_rls_permissions.sql`
5. `supabase/migrations/456_add_image_to_groups.sql`
6. `supabase/migrations/457_create_group_images_storage.sql`
7. `supabase/migrations/458_create_group_requests_table.sql`
8. `supabase/migrations/459_update_groups_rls_allow_viewing_private.sql`

## Frontend Files to DELETE

### Page Routes
1. `src/app/groups/page.tsx`
2. `src/app/groups/new/page.tsx`
3. `src/app/groups/[slug]/page.tsx`
4. `src/app/groups/[slug]/GroupPageClient.tsx`
5. `src/app/groups/[slug]/settings/page.tsx`
6. `src/app/groups/[slug]/settings/GroupSettingsClient.tsx`

### API Routes
1. `src/app/api/groups/route.ts`
2. `src/app/api/groups/[slug]/route.ts`
3. `src/app/api/groups/[slug]/members/route.ts`
4. `src/app/api/groups/[slug]/requests/route.ts`
5. `src/app/api/groups/[slug]/requests/[id]/route.ts`

### Components
1. `src/components/groups/GroupsContent.tsx`
2. `src/components/feed/GroupsSidebar.tsx`

### Types
1. `src/types/group.ts`

### Constants
- Remove `GROUP_IMAGES: 'group-images'` from `src/constants/storage.ts`

## Code References to REMOVE/CLEAN UP

### Files with group references (need cleanup, not deletion):
1. `src/components/layout/PageWrapper.tsx` - Remove groups navigation
2. `src/components/feed/FeedContent.tsx` - Remove groups filtering/display
3. `src/components/layout/HamburgerMenu.tsx` - Remove groups menu item
4. `src/components/layout/SearchResults.tsx` - Remove groups search results
5. `src/components/layout/ContentTypeFilters.tsx` - Remove groups filter
6. `src/components/layout/MapSearchInput.tsx` - Remove groups from search
7. `src/app/post/[id]/edit/page.tsx` - Remove group selection
8. `src/components/feed/CreatePostModal.tsx` - Remove group selection
9. `src/lib/billing/featureLimits.ts` - Remove groups feature limit checks
10. `src/app/api/posts/[id]/route.ts` - Remove group_id handling
11. `src/app/api/posts/route.ts` - Remove group_id handling
12. `src/features/session/components/AppHeader.tsx` - Remove groups navigation
13. `src/features/session/components/ProfileDropdown.tsx` - Remove groups links
14. `src/features/profiles/components/ProfileSidebar.tsx` - Remove groups display
15. `src/features/profiles/components/ProfileCollectionsList.tsx` - Remove groups
16. `src/features/profiles/components/ProfilePinsList.tsx` - Remove groups
17. `src/features/settings/components/SettingsPageClient.tsx` - Remove groups settings
18. `src/features/upgrade/components/BusinessSetupForm.tsx` - Remove groups feature
19. `src/components/layout/CollectionsManagement.tsx` - Remove groups
20. `src/components/layout/ContributeContent.tsx` - Remove groups
21. `src/components/layout/BottomButtons.tsx` - Remove groups button
22. `src/components/layout/SearchResults.tsx` - Remove groups results
23. `src/components/feed/PostImageDrawer.tsx` - Remove groups context
24. `src/features/posts/components/PostDetailClient.tsx` - Remove groups display
25. `src/app/gov/GovPageClient.tsx` - Remove groups references
26. `src/app/people/PeoplePageClient.tsx` - Remove groups references
27. `src/components/landing/LandingPage.tsx` - Remove groups references
28. `src/app/add/page.tsx` - Remove groups option
29. `src/components/profile/ProfileCard.tsx` - Remove groups display
30. `src/features/profiles/components/ProfileCard.tsx` - Remove groups display
31. `src/app/admin/billing/BillingAdminClient.tsx` - Remove groups feature
32. `src/app/analytics/AnalyticsClient.tsx` - Remove groups analytics

### Migration files with group references (comments only, safe to leave):
- `supabase/migrations/475_add_feature_limits.sql` - Contains groups example in comments
- `supabase/migrations/485_redesign_map_system_phase1.sql` - Contains comparison comment
- `supabase/migrations/487_redesign_map_system_phase3.sql` - Contains comparison comment

## Database Migration to CREATE

Create a new migration file that:
1. Drops all group-related tables, functions, triggers, policies, indexes
2. Removes `group_id` column from `posts` table
3. Removes groups feature from billing system
4. Drops storage bucket and policies
5. Revokes all grants
6. Drops enum type

## Notes

- The `posts.group_id` column should be set to NULL for all existing posts before dropping the foreign key constraint
- Storage bucket deletion may need to be done manually through Supabase dashboard or CLI
- All group-related data will be permanently deleted
- Consider backing up any important group data before deletion
