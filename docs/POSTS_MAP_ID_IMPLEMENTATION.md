# Posts `map_id` Implementation Checklist

## Overview
Add `map_id` column to `posts` table to align posts with the map-centric architecture where maps are the global wrapper for functionality and permissions.

**Migration Number:** 494 (next after 493)

---

## Phase 1: Database Migration ✅

### Step 1.1: Create Migration File
- [ ] Create `supabase/migrations/494_add_map_id_to_posts.sql`
- [ ] Add `map_id` column (nullable UUID, foreign key to `map.id`)
- [ ] Add foreign key constraint with `ON DELETE SET NULL`
- [ ] Add index: `CREATE INDEX posts_map_id_idx ON posts(map_id) WHERE map_id IS NOT NULL;`
- [ ] Add composite index: `CREATE INDEX posts_map_id_visibility_created_idx ON posts(map_id, visibility, created_at DESC) WHERE map_id IS NOT NULL;`
- [ ] Add comment: `COMMENT ON COLUMN posts.map_id IS 'Map this post belongs to. Nullable for backward compatibility. Posts inherit map permissions and visibility.';`

### Step 1.2: Test Migration
- [ ] Run migration on local database
- [ ] Verify column exists and is nullable
- [ ] Verify foreign key constraint works
- [ ] Verify indexes are created
- [ ] Test that existing posts have `map_id = NULL` (safe default)

---

## Phase 2: RLS Policy Updates ✅

### Step 2.1: Review Current RLS Policies
- [ ] Read current posts RLS policies from latest migration
- [ ] Identify which policies need map access checks
- [ ] Document current policy logic

### Step 2.2: Create Helper Function (if needed)
- [ ] Check if `is_map_member()` function exists (should from map system)
- [ ] Verify function signature matches our needs
- [ ] Create wrapper function if needed: `can_user_access_map_post(map_id UUID, account_id UUID)`

### Step 2.3: Update SELECT Policies
- [ ] Update `posts_select_anon` policy:
  - Allow if `visibility = 'public'` AND (`map_id IS NULL` OR map is public)
- [ ] Update `posts_select_authenticated` policy:
  - Allow if own post OR
  - Allow if `visibility = 'public'` AND (`map_id IS NULL` OR map is public OR user is map member)
  - Allow if `visibility = 'draft'` AND own post
- [ ] Test with various scenarios:
  - Post with `map_id = NULL` (should work as before)
  - Post on public map (should be visible to all)
  - Post on private map (should only be visible to members)
  - Draft post on private map (should only be visible to author)

### Step 2.4: Update INSERT Policy
- [ ] Update `posts_insert` policy:
  - Check account ownership (existing)
  - If `map_id` provided, check:
    - Map exists and is active
    - User has access (public map OR map member)
    - Map allows posts (`settings.collaboration.allow_posts = true`)
    - User's plan meets requirement (`settings.collaboration.post_permissions.required_plan`)
- [ ] Test insert scenarios:
  - Post without `map_id` (should work as before)
  - Post with `map_id` on public map (should work if map allows)
  - Post with `map_id` on private map (should require membership)
  - Post with `map_id` where map doesn't allow posts (should fail)

### Step 2.5: Update UPDATE Policy
- [ ] Update `posts_update` policy:
  - Check account ownership (existing)
  - If updating `map_id`, apply same checks as INSERT
  - If post has `map_id`, verify user still has map access
- [ ] Test update scenarios:
  - Update post content (should work if owner)
  - Update `map_id` from NULL to valid map (should check map access)
  - Update `map_id` from one map to another (should check both maps)

### Step 2.6: Update DELETE Policy
- [ ] Update `posts_delete` policy:
  - Check account ownership (existing)
  - If post has `map_id`, verify user has map access (owner or manager)
- [ ] Test delete scenarios:
  - Delete own post (should work)
  - Delete post on map where user is manager (should work)
  - Delete post on map where user is not member (should fail)

### Step 2.7: Performance Testing
- [ ] Test RLS policy performance with EXPLAIN ANALYZE
- [ ] Verify indexes are being used
- [ ] Check for N+1 query issues
- [ ] Consider adding materialized view if performance is poor

---

## Phase 3: Backend/API Updates ✅

### Step 3.1: Update TypeScript Types
- [ ] Update `src/types/post.ts`:
  - Add `map_id: string | null` to `Post` interface
  - Add `map?: { id: string; name: string; slug: string; visibility: string } | null` to `Post` interface
  - Add `map_id?: string | null` to `CreatePostData` interface
  - Add `map_id?: string | null` to `UpdatePostData` interface
  - Add `map_id?: string` to `PostFilters` interface

### Step 3.2: Create Map Permission Service
- [ ] Create `src/lib/maps/postPermissions.ts`:
  - Function: `canUserCreatePostOnMap(mapId: string, userId: string)`
  - Function: `validateMapPostPermissions(mapId: string, userId: string)`
  - Reuse existing map permission logic from `src/lib/maps/permissions.ts`
  - Check: map exists, is active, allows posts, user has access, plan requirements

### Step 3.3: Update POST `/api/posts` Route
- [ ] Update `src/app/api/posts/route.ts`:
  - Add `map_id` to `createPostSchema` (optional UUID)
  - Validate `map_id` if provided:
    - Map exists
    - User has access (public map OR map member)
    - Map allows posts
    - User's plan meets requirement
  - Include `map_id` in insert statement
  - Return `map` relation in select query
- [ ] Test endpoint:
  - Create post without `map_id` (should work)
  - Create post with `map_id` (should validate and work)
  - Create post with invalid `map_id` (should fail)
  - Create post on map without access (should fail)
  - Create post on map that doesn't allow posts (should fail)

### Step 3.4: Update GET `/api/posts` Route
- [ ] Update `src/app/api/posts/route.ts`:
  - Add `map_id` filter parameter
  - Filter posts by `map_id` if provided
  - Include `map` relation in select query
  - Apply map access filtering (respect RLS)
- [ ] Test endpoint:
  - Get all posts (should work, respect RLS)
  - Get posts by `map_id` (should return only accessible posts)
  - Get posts for private map (should only return if member)

### Step 3.5: Update PATCH `/api/posts/[id]` Route
- [ ] Update `src/app/api/posts/[id]/route.ts`:
  - Add `map_id` to update schema (optional UUID)
  - Validate `map_id` if provided (same checks as POST)
  - Allow updating `map_id` (with validation)
  - Include `map` relation in select query
- [ ] Test endpoint:
  - Update post content (should work)
  - Update `map_id` from NULL to valid map (should validate)
  - Update `map_id` from one map to another (should validate both)
  - Update `map_id` to invalid map (should fail)

### Step 3.6: Create GET `/api/maps/[id]/posts` Route (Optional)
- [ ] Create `src/app/api/maps/[id]/posts/route.ts`:
  - Get posts for specific map
  - Respect map visibility and membership
  - Include pagination
  - Include post author info
- [ ] Test endpoint:
  - Get posts for public map (should work)
  - Get posts for private map (should require membership)
  - Test pagination

---

## Phase 4: Frontend Updates ✅

### Step 4.1: Update Post Components - Types
- [ ] Update all components that use `Post` type:
  - `src/components/feed/FeedContent.tsx`
  - `src/components/feed/CreatePostModal.tsx`
  - `src/app/post/[id]/page.tsx`
  - `src/app/post/[id]/edit/page.tsx`
  - Any other components using Post type

### Step 4.2: Update CreatePostModal
- [ ] Add map selector UI to `src/components/feed/CreatePostModal.tsx`:
  - Add map picker dropdown/selector
  - Show user's accessible maps (public maps + maps where user is member)
  - Allow "No map" option (for general posts)
  - Show map info (name, visibility) when selected
  - Validate map selection before submit
- [ ] Update form submission:
  - Include `map_id` in POST request
  - Handle validation errors from API
- [ ] Test UI:
  - Create post without map (should work)
  - Create post with map (should validate and work)
  - Create post on private map (should show only if member)

### Step 4.3: Update Feed Components
- [ ] Update `src/components/feed/FeedContent.tsx`:
  - Show map context for posts with `map_id`
  - Display map name/link if post belongs to map
  - Add filter by map (if needed)
- [ ] Update `src/components/feed/PostCard.tsx` (if exists):
  - Show map badge/indicator
  - Link to map page

### Step 4.4: Update Post Detail Page
- [ ] Update `src/app/post/[id]/page.tsx`:
  - Display map context if post has `map_id`
  - Show map link/navigation
  - Include map info in post header

### Step 4.5: Update Post Edit Page
- [ ] Update `src/app/post/[id]/edit/page.tsx`:
  - Add map selector (same as CreatePostModal)
  - Allow changing `map_id`
  - Validate map access

### Step 4.6: Update Map Pages
- [ ] Update `src/app/map/[id]/page.tsx`:
  - Add posts section to map page
  - Display posts associated with map
  - Add "Create Post" button (if user has permission)
  - Filter posts by map
- [ ] Test:
  - Show posts on map page
  - Create post from map page (should auto-set `map_id`)
  - Respect map permissions for post creation

### Step 4.7: Update Feed Filters
- [ ] Add map filter to feed:
  - Filter posts by map
  - Show "All posts" and "Posts by map" options
  - Update `src/components/feed/MentionTypeFilter.tsx` or create new filter component

---

## Phase 5: Testing ✅

### Step 5.1: Unit Tests
- [ ] Test map permission functions
- [ ] Test post creation validation
- [ ] Test RLS policy logic (if possible)

### Step 5.2: Integration Tests
- [ ] Test post creation with `map_id`
- [ ] Test post creation without `map_id`
- [ ] Test post filtering by `map_id`
- [ ] Test map access validation
- [ ] Test plan-based permissions

### Step 5.3: E2E Tests
- [ ] Create post on public map
- [ ] Create post on private map (as member)
- [ ] Try to create post on private map (as non-member) - should fail
- [ ] View posts on map page
- [ ] Filter posts by map in feed
- [ ] Update post `map_id`

### Step 5.4: Performance Tests
- [ ] Test RLS policy performance with many posts
- [ ] Test queries with `map_id` filter
- [ ] Test queries with map joins
- [ ] Monitor query execution times

### Step 5.5: Security Tests
- [ ] Test RLS policies prevent unauthorized access
- [ ] Test that private map posts are hidden from non-members
- [ ] Test that plan requirements are enforced
- [ ] Test that map collaboration settings are respected

---

## Phase 6: Documentation ✅

### Step 6.1: Update API Documentation
- [ ] Document `map_id` parameter in POST `/api/posts`
- [ ] Document `map_id` filter in GET `/api/posts`
- [ ] Document new endpoint GET `/api/maps/[id]/posts` (if created)
- [ ] Document permission requirements

### Step 6.2: Update Code Comments
- [ ] Add JSDoc comments to new functions
- [ ] Document RLS policy logic
- [ ] Document permission checks

### Step 6.3: Update User Documentation (if needed)
- [ ] Document how posts relate to maps
- [ ] Document map-based post permissions

---

## Phase 7: Deployment ✅

### Step 7.1: Pre-Deployment Checklist
- [ ] All migrations tested locally
- [ ] All API endpoints tested
- [ ] All frontend components tested
- [ ] Performance tests passed
- [ ] Security tests passed
- [ ] Documentation updated

### Step 7.2: Deployment Strategy
- [ ] Deploy migration first (safe, backward compatible)
- [ ] Deploy backend/API updates
- [ ] Deploy frontend updates
- [ ] Monitor for errors
- [ ] Rollback plan ready

### Step 7.3: Post-Deployment
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Check RLS policy performance
- [ ] Verify user feedback
- [ ] Fix any issues

---

## Rollback Plan

If issues arise:

1. **Database Rollback:**
   - Migration is additive (nullable column), so rollback is safe
   - Can drop column if needed: `ALTER TABLE posts DROP COLUMN map_id;`
   - Can drop indexes: `DROP INDEX posts_map_id_idx;`

2. **API Rollback:**
   - Revert API changes to previous version
   - Frontend will continue to work (just won't use `map_id`)

3. **Frontend Rollback:**
   - Revert frontend changes
   - Posts will work without map context

---

## Success Criteria

- [ ] Posts can be created with `map_id`
- [ ] Posts can be created without `map_id` (backward compatible)
- [ ] RLS policies correctly enforce map access
- [ ] Map permissions are respected (collaboration settings, plan requirements)
- [ ] Frontend shows map context for posts
- [ ] Map pages display associated posts
- [ ] Performance is acceptable
- [ ] No security vulnerabilities introduced

---

## Notes

- **Backward Compatibility:** `map_id` is nullable, so existing posts continue to work
- **Performance:** Monitor RLS policy performance, may need optimization
- **Future:** Consider making `map_id` required in future version (breaking change)
- **Data Migration:** No automatic assignment of `map_id` to existing posts (manual if needed)
