# Post Mention Type Filtering & Tagging Implementation

## Overview
Posts now support direct categorization via `mention_type_id`, allowing users to tag posts with a mention type (e.g., "Love", "Parks", "Restaurants") for improved organization and filtering.

**Important**: Only active mention types (`is_active = true`) are shown in the tag selector. Admins can manage mention type visibility separately, but the post creation interface only displays active types for public use.

## Implementation Details

### 1. Create Post Modal - Tag Selector

**File**: `src/components/feed/CreatePostModal.tsx`

**Features**:
- Red "#" button labeled "Add tag" appears below group selector
- Click opens modal with searchable mention type list
- **Only active mention types are shown** (filtered by `is_active = true`)
- Single-select card-based UI matching add mention form pattern
- Selected tag displays with emoji, name, and close icon for removal
- Tag is submitted as `mention_type_id` with post creation

**UI Behavior**:
- Initial state: Red "#" icon with "Add tag" text
- On click: Opens modal with search input and card grid
- On select: Closes modal, displays selected tag as removable badge
- On remove: Clears selection, returns to "#" button state

### 2. API Filtering

**File**: `src/app/api/posts/route.ts`

**Changes**:
- Added `mention_type_id` query parameter to GET endpoint
- Filters posts by `mention_type_id` when provided
- Returns `mention_type` relation data (emoji, name) for display

**Query Parameters**:
- `mention_type_id` (UUID): Filter posts by specific mention type
- Existing filters still work: `account_id`, `group_id`, `mention_time`

### 3. Feed Content Integration

**File**: `src/components/feed/FeedContent.tsx`

**Changes**:
- Reads `type` URL parameter (mention type slug)
- Converts slug to `mention_type_id` via lookup (filtered by `is_active = true`)
- Passes `mention_type_id` to API for filtering
- Refetches posts when mention type filter changes

**Active Filtering**:
- Only active mention types are used for filtering
- Inactive types are excluded from slug-to-ID conversion
- Ensures consistency with tag selector and other components

### 4. Post Display

**File**: `src/components/feed/FeedPost.tsx`

**Current Display**:
- Shows mention type inline in header: `@username • 🎭 Museums • timestamp`
- Displays between username and timestamp with bullet separators

## Additional Improvements Needed

### Post Card Enhancements

**Filtering & Tagging**:
- [ ] Add mention type badge/chip below post content (in addition to header)
- [ ] Make mention type in header clickable to filter by that type
- [ ] Add hover tooltip showing full mention type name
- [ ] Consider color-coding or visual styling per mention type category

**Visual Hierarchy**:
- [ ] Increase mention type emoji size in header (currently same as text)
- [ ] Add subtle background color to mention type in header
- [ ] Consider moving mention type to a more prominent position

**Interaction**:
- [ ] Click mention type → filter feed by that type
- [ ] Right-click mention type → show related posts count
- [ ] Add "View all [Type]" quick action

### Post Detail Page Enhancements

**File**: `src/app/post/[id]/page.tsx`

**Improvements**:
- [ ] Display mention type as prominent badge at top of post
- [ ] Add "More posts like this" section filtered by mention_type_id
- [ ] Show mention type statistics (total posts with this type)
- [ ] Add breadcrumb: Home > Feed > [Mention Type] > Post
- [ ] Make mention type clickable → navigate to filtered feed

### Mention Type Filter Component

**File**: `src/components/feed/MentionTypeFilter.tsx`

**Current State**: Uses URL slugs, no direct ID filtering

**Improvements**:
- [ ] Persist selected filters across sessions (localStorage)
- [ ] Show post count per mention type in filter list
- [ ] Add "Recently used" section at top of filter list
- [ ] Support multiple mention type selection (OR logic)
- [ ] Add "Clear all filters" button
- [ ] Visual indicator when filter is active (highlighted state)

### Database & Schema

**Table**: `posts`
- ✅ Column exists: `mention_type_id UUID` (nullable)
- ✅ Foreign key: `posts_mention_type_id_fkey` → `mention_types(id)`
- ✅ Index: `posts_mention_type_id_idx` (WHERE mention_type_id IS NOT NULL)

**Table**: `mention_types`
- ✅ Column: `is_active BOOLEAN NOT NULL DEFAULT true`
- ✅ Index: `idx_mention_types_is_active` (WHERE is_active = true)
- ✅ Only active types shown in public selection interfaces
- ✅ Admins can manage visibility separately

**Migrations**: 
- `supabase/migrations/455_add_mention_type_id_to_posts.sql` - Post tagging
- `supabase/migrations/430_add_is_active_to_mention_types.sql` - Active filtering

### API Enhancements

**Additional Query Parameters**:
- [ ] `mention_type_ids[]` - Support multiple mention type filtering (OR logic)
- [ ] `exclude_mention_type_ids[]` - Exclude specific mention types
- [ ] `include_stats=true` - Return mention type post counts

**Response Enhancements**:
- [ ] Include mention type slug in response for URL generation
- [ ] Add `mention_type_post_count` field
- [ ] Return `related_mention_types` based on post content

### Search & Discovery

**Improvements**:
- [ ] Add mention type autocomplete in post search
- [ ] Support mention type in advanced search filters
- [ ] Create "Explore by Type" landing page
- [ ] Add mention type suggestions based on post content
- [ ] Show trending mention types in sidebar

### Analytics & Insights

**Post-Level Analytics**:
- [ ] Track views per mention type
- [ ] Track engagement (likes/comments) per mention type
- [ ] Most popular mention types by time period
- [ ] User's most used mention types

**User Preferences**:
- [ ] Allow users to follow specific mention types
- [ ] Smart feed curation based on mention type interactions
- [ ] Notification settings per mention type

### Mobile Experience

**Improvements**:
- [ ] Bottom sheet for mention type selection (vs modal)
- [ ] Swipeable mention type filter chips
- [ ] Quick action: Long-press post → Change mention type
- [ ] Mention type shortcuts in post composer

### Accessibility

**ARIA & Keyboard Navigation**:
- [ ] Add `aria-label` to mention type selector button
- [ ] Support keyboard navigation in mention type modal
- [ ] Announce filter changes to screen readers
- [ ] Add keyboard shortcut to open mention type selector (e.g., Cmd+T)

### Performance Optimizations

**Caching**:
- [ ] Cache mention types in memory/localStorage
- [ ] Prefetch mention types on app load
- [ ] Implement mention type filter preloading

**Loading States**:
- [ ] Skeleton loaders for filtered posts
- [ ] Optimistic updates when changing mention type
- [ ] Progressive loading for mention type list

## Testing Checklist

### Functionality
- [ ] Create post with mention type → saves correctly
- [ ] Create post without mention type → null value saved
- [ ] Filter feed by mention type → shows correct posts
- [ ] Remove mention type from post → updates correctly
- [ ] Search mention types in modal → filters correctly
- [ ] Multiple posts with same type → all appear in filter

### Edge Cases
- [ ] Mention type deleted → posts still display (SET NULL)
- [ ] Invalid mention_type_id → API returns validation error
- [ ] Empty mention type filter → shows all posts
- [ ] Mention type with no posts → filter shows empty state

### UI/UX
- [ ] Tag button accessible on mobile
- [ ] Modal scrolls on small screens
- [ ] Selected tag truncates long names gracefully
- [ ] Filter state persists on page refresh (if implemented)
- [ ] Loading states clear and responsive

## Future Enhancements

### Advanced Filtering
- Combine mention_type_id with mention_time filters
- Filter by multiple mention types (OR/AND logic)
- Exclude specific mention types from feed
- Smart filters: "Similar to this type"

### AI/ML Integration
- Auto-suggest mention type based on post content
- Predict user's intended mention type
- Recommend related mention types
- Content classification for untagged posts

### Gamification
- Badges for posting in multiple mention types
- "Type Explorer" achievement system
- Leaderboards per mention type
- Mention type diversity score

### Integration
- Mention type in email notifications
- RSS feeds per mention type
- Webhook events for new posts by type
- API endpoints for mention type analytics

## Related Files
- `src/components/feed/CreatePostModal.tsx` - Post creation UI (✅ filters by is_active)
- `src/app/api/posts/route.ts` - Posts API endpoints
- `src/components/feed/FeedContent.tsx` - Feed display logic (✅ filters by is_active)
- `src/components/feed/FeedPost.tsx` - Post card display
- `src/components/feed/MentionTypeFilter.tsx` - Filter sidebar (✅ filters by is_active)
- `src/app/post/[id]/page.tsx` - Post detail page
- `src/app/add/page.tsx` - Add mention page (✅ filters by is_active)
- `src/components/layout/CreateMentionPopup.tsx` - Mention creation popup (✅ filters by is_active)
- `src/components/layout/MentionTypeFilterContent.tsx` - Mention filter (✅ filters by is_active)
- `src/components/layout/SearchResults.tsx` - Search functionality (✅ filters by is_active)
- `src/components/layout/MapTopContainer.tsx` - Map filters (✅ filters by is_active)
- `src/components/layout/BottomButtons.tsx` - Bottom UI buttons (✅ filters by is_active)
- `src/components/layout/LocationSelectPopup.tsx` - Location selector (✅ filters by is_active)
- `supabase/migrations/455_add_mention_type_id_to_posts.sql` - Schema migration
- `supabase/migrations/430_add_is_active_to_mention_types.sql` - Active filtering migration

**Note**: All public-facing mention type selectors filter by `is_active = true` to ensure only active types are shown to users. Admin interfaces have separate access to all mention types for management purposes.
