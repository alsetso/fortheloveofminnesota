# Adding `map_id` to Posts Table: Analysis & Implementation Plan

## Strategic Rationale: Maps as Global Wrapper

**Maps are becoming the primary organizational and permission layer for Love of Minnesota.**

This change is part of a larger architectural evolution where **maps serve as the global container** for functionality and permissions across the platform. Maps are not just a feature—they are the wrapper that controls:

1. **Permissions & Access Control**
   - Map membership (owner/manager/editor roles)
   - Collaboration settings (who can add pins/areas/posts)
   - Plan-based permissions (which plan level required for actions)
   - Visibility controls (public/private maps)

2. **Content Organization**
   - Maps contain `map_pins` (location-based content)
   - Maps contain `map_areas` (drawn regions)
   - Maps should contain `posts` (discussions, updates, stories)
   - All content is scoped to a map's context

3. **Billing & Feature Gating**
   - Map creation limits based on user plan
   - Plan-based permissions for editing (pins/areas/posts)
   - Map analytics and export features
   - Advanced collaboration tools

4. **User Experience**
   - Maps provide context for all content
   - Users navigate by map, not by content type
   - Map pages aggregate all related content (pins, areas, posts)
   - Map feeds show everything happening in a map's context

**Why Posts Need `map_id`:**
- Posts should inherit map permissions (who can create/see posts)
- Posts should be discoverable within map context
- Posts should respect map visibility (private maps = private posts)
- Posts should be filterable by map (map-specific feeds)
- Posts should leverage map membership for access control

**This is not just adding a column—it's aligning posts with the map-centric architecture.**

### Architectural Alignment

**Current Map-Centric Entities:**
- ✅ `map_pins` → `map_id` (location-based content)
- ✅ `map_areas` → `map_id` (drawn regions)
- ✅ `map_members` → `map_id` (membership/roles)
- ❌ `posts` → **NO `map_id`** (orphaned from map context)

**After This Change:**
- ✅ `map_pins` → `map_id`
- ✅ `map_areas` → `map_id`
- ✅ `map_members` → `map_id`
- ✅ `posts` → `map_id` **← NEW**

**Result:** All content types are now organized under maps, enabling:
- Unified permission model (map controls all content)
- Map-scoped queries (get all content for a map)
- Map-based navigation (maps are the primary organizational unit)
- Consistent access control (map membership = access to all content)

## Current State

### Posts Table Structure
- Posts currently have **map-related data columns** (`map_type`, `map_geometry`, `map_center`, `map_bounds`, `map_screenshot`) that store map drawing data
- Posts have a `map_data` JSONB column for backward compatibility
- **No direct foreign key** linking posts to a specific `map` record
- Posts are associated with accounts via `account_id`

### Maps Table Structure
- Maps have a membership system (`map_members`, `map_membership_requests`)
- Maps have collaboration settings (who can add pins/areas/posts)
- Maps have visibility settings (`public`, `private`)
- Maps have `map_pins` and `map_areas` tables that reference `map_id`

## Proposed Change

Add a `map_id` column to the `posts` table:
```sql
ALTER TABLE public.posts
  ADD COLUMN map_id UUID REFERENCES public.map(id) ON DELETE SET NULL;
```

This creates a **direct relationship** between posts and maps, similar to how `map_pins` and `map_areas` work.

## Implications

### 1. **Data Model Changes**

**Semantic Shift:**
- **Before**: Posts contain map drawing data (pins/areas) but aren't necessarily "on" a specific map. Posts are account-owned with no map context.
- **After**: Posts belong to maps, inheriting map permissions and context. Maps become the organizational wrapper for posts, just like they are for pins and areas.

**Relationship Types:**
- Posts can have `map_id = NULL` (general posts, not tied to a map)
- Posts can have `map_id` set (posts belonging to a specific map)
- Posts can have both `map_id` AND map drawing data (`map_geometry`, etc.)

### 2. **Database Implications**

**Foreign Key Constraint:**
- `ON DELETE SET NULL` means if a map is deleted, posts remain but lose their map association
- Alternative: `ON DELETE CASCADE` would delete posts when map is deleted (likely too destructive)

**Indexing:**
- Need index on `map_id` for efficient queries: `CREATE INDEX posts_map_id_idx ON posts(map_id) WHERE map_id IS NOT NULL;`
- Composite indexes for common queries: `(map_id, visibility, created_at)`

**Data Migration:**
- Existing posts will have `map_id = NULL` (safe default)
- May need migration script to assign `map_id` to existing posts based on business logic

### 3. **RLS (Row Level Security) Implications**

**Current RLS Policies:**
- Posts RLS is based on `account_id` ownership and `visibility`
- No map-based access control currently

**New RLS Requirements:**
- Posts with `map_id` should respect map visibility settings
- Posts on private maps: only visible to map members
- Posts on public maps: visible to everyone (if post visibility allows)
- Need to check map membership for private maps

**Policy Updates Needed:**
```sql
-- Example: Update SELECT policy to check map access
CREATE POLICY "posts_select_with_map_access"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    -- Existing logic: own posts or public visibility
    (visibility = 'public' OR public.user_owns_account(account_id))
    AND
    -- New logic: if map_id exists, check map access
    (
      map_id IS NULL 
      OR 
      (
        -- Public map: anyone can see
        EXISTS (SELECT 1 FROM public.map WHERE id = map_id AND visibility = 'public' AND is_active = true)
        OR
        -- Private map: must be member
        public.is_map_member(map_id, (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1))
      )
    )
  );
```

**Complexity:**
- RLS policies become more complex (nested conditions)
- Performance impact: additional subqueries for map access checks
- May need helper functions similar to `is_map_member()` for performance

### 4. **API Changes**

**POST `/api/posts` (Create Post):**
- Add `map_id` to request schema (optional)
- Validate `map_id` exists and user has permission to post on that map
- Check map collaboration settings (`allow_others_to_create_posts`)
- Check map membership if map is private

**GET `/api/posts` (List Posts):**
- Add `map_id` filter parameter
- Update queries to join with `map` table for access control
- Filter posts by map visibility/membership

**GET `/api/maps/[id]/posts` (New Endpoint?):**
- New endpoint to get posts for a specific map
- Respects map visibility and membership

**PATCH `/api/posts/[id]` (Update Post):**
- Allow updating `map_id` (with permission checks)
- Validate map access when changing `map_id`

### 5. **Frontend Changes**

**TypeScript Types:**
```typescript
// src/types/post.ts
export interface Post {
  // ... existing fields
  map_id: string | null;
  map?: {
    id: string;
    name: string;
    slug: string;
    visibility: string;
  } | null;
}
```

**Create Post Modal:**
- Add map selector UI component
- Show map picker when creating posts
- Validate map selection (user must have access)

**Feed Components:**
- Filter posts by map
- Show map context for posts with `map_id`
- Link to map page from post

**Map Pages:**
- Display posts associated with the map
- Show post creation UI on map pages
- Filter posts by map in feed views

### 6. **Business Logic Implications**

**Post Creation Rules:**
1. If `map_id` is provided:
   - User must have access to the map (member or public map)
   - Map must allow posts (check `settings.collaboration.allow_posts`)
   - Map must allow user's plan level (check `settings.collaboration.post_permissions.required_plan`)
   - If private map, user must be member (or map must auto-approve)
   - Post inherits map's visibility context (private map = private post context)

2. If `map_id` is NULL:
   - Post is general (not tied to a map) - **legacy behavior for backward compatibility**
   - Existing behavior continues
   - **Note**: Future versions may require `map_id` for all posts

**Post Visibility (Two-Layer Model):**
- **Layer 1: Post `visibility`** (public/draft) - controls post-level visibility
- **Layer 2: Map visibility** - adds map context layer:
  - Public map + public post = visible to all
  - Public map + draft post = visible to author only
  - Private map + any post = visible to map members only (map membership required)
  
**This aligns with the map-centric permission model where maps control access to all content within them.**

**Map Collaboration Settings:**
- Maps have `settings.collaboration.allow_posts` setting (binary toggle)
- Maps have `settings.collaboration.post_permissions.required_plan` (plan-based gating)
- Maps have `settings.collaboration.role_overrides` (managers/editors always have access)
- **This is the same permission model used for pins and areas** - posts inherit map's permission structure

### 7. **Migration Strategy**

**Phase 1: Add Column (Safe)**
```sql
-- Add nullable column (no data loss)
ALTER TABLE public.posts
  ADD COLUMN map_id UUID REFERENCES public.map(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX posts_map_id_idx ON public.posts(map_id) WHERE map_id IS NOT NULL;
```

**Phase 2: Update RLS Policies**
- Add map access checks to existing policies
- Test thoroughly with both `map_id IS NULL` and `map_id IS NOT NULL` cases

**Phase 3: Update API & Frontend**
- Add `map_id` to API endpoints
- Update TypeScript types
- Add UI components for map selection

**Phase 4: Data Migration (Optional)**
- If needed, assign `map_id` to existing posts based on business logic
- Example: posts with map drawing data might be assigned to a default map

## Required Changes Summary

### Database
1. ✅ Add `map_id` column to `posts` table
2. ✅ Add foreign key constraint
3. ✅ Add indexes for performance
4. ✅ Update RLS policies to check map access
5. ✅ Add helper functions for map access checks (if needed)

### Backend/API
1. ✅ Update POST `/api/posts` to accept `map_id`
2. ✅ Add map access validation in post creation
3. ✅ Update GET `/api/posts` to filter by `map_id`
4. ✅ Consider new endpoint: GET `/api/maps/[id]/posts`
5. ✅ Update PATCH `/api/posts/[id]` to allow `map_id` updates

### Frontend
1. ✅ Update TypeScript types (`src/types/post.ts`)
2. ✅ Add map selector to `CreatePostModal`
3. ✅ Update feed components to show map context
4. ✅ Add map filtering to feed views
5. ✅ Update map pages to show associated posts

### Testing
1. ✅ Test RLS policies with various map visibility scenarios
2. ✅ Test post creation with/without `map_id`
3. ✅ Test map access validation
4. ✅ Test performance with new indexes

## Decision Points

1. **Should `map_id` be nullable?**
   - ✅ **YES** - Allows posts to exist without being tied to a map (backward compatible)

2. **ON DELETE behavior?**
   - ✅ **SET NULL** - Preserves posts when map is deleted
   - ❌ CASCADE - Too destructive, would delete user content

3. **Should existing posts get `map_id` assigned?**
   - ⚠️ **DEPENDS** - Need business logic to determine which posts belong to which maps
   - Posts with `map_geometry` might be candidates for assignment

4. **RLS Performance?**
   - ⚠️ **MONITOR** - Additional subqueries may impact performance
   - Consider materialized views or denormalized access flags if needed

## Implementation

**See [POSTS_MAP_ID_IMPLEMENTATION.md](./POSTS_MAP_ID_IMPLEMENTATION.md) for detailed step-by-step implementation checklist.**

### Quick Start

1. **Database:** Create migration `494_add_map_id_to_posts.sql`
2. **RLS:** Update policies to check map access
3. **API:** Add `map_id` to post creation/update endpoints
4. **Frontend:** Add map selector to post creation UI
5. **Testing:** Test all scenarios thoroughly

### Implementation Phases

1. **Phase 1:** Database migration (safe, backward compatible)
2. **Phase 2:** RLS policy updates (critical for security)
3. **Phase 3:** Backend/API updates (add `map_id` support)
4. **Phase 4:** Frontend updates (UI for map selection)
5. **Phase 5:** Testing (unit, integration, E2E, performance, security)
6. **Phase 6:** Documentation
7. **Phase 7:** Deployment

**Full checklist with 50+ specific tasks available in implementation document.**
