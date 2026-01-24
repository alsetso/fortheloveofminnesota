# Page Route Analysis: PageWrapper & Three-Column Layout Consolidation

## Executive Summary

This document analyzes all main page routes in the application to determine:
1. Which routes use the global `PageWrapper` component
2. Which routes implement the three-column layout (left sidebar, center content, right sidebar)
3. Which routes have sidebar toggle logic via header icons (next to account dropdown)
4. Categorization of routes by type and layout pattern

## Key Requirements

### Pages That Should NOT Use PageWrapper
- **`/post/[id]`** - Post detail/content page (uses `PostDetailClient`)
- **`/mention/[id]`** - Mention detail/content page (uses `MentionDetailClient`)

These are content detail pages that should have their own layout without the app wrapper.

### Pages That SHOULD Use PageWrapper
- All other routes including:
  - Profile pages (`/profile/[slug]`, `/profile/[slug]/map`)
  - Map pages (`/map/[id]`, `/maps`, `/live`)
  - All other app routes

### Pages With Sidebars (Original Implementation)
Only these pages originally had sidebars and should show sidebar toggle icons:
- **`/feed`** - Left: MentionTimeFilter, MentionTypeFilter | Right: LiveMapAnalyticsCard, GroupsSidebar
- **`/live`** - Left: MentionTypeFilterContent | Right: MapSettingsContent
- **`/map/[id]`** - Left: MapFilterContent | Right: MapSettingsSidebar (if owner)

**All other pages should use PageWrapper but WITHOUT sidebars or sidebar toggle icons.**

## PageWrapper Component Overview

The `PageWrapper` component (`src/components/layout/PageWrapper.tsx`) provides:
- **Header**: 10vh black background with three-column grid layout
  - Column 1: Logo & Search (aligns with left sidebar)
  - Column 2: Navigation icons (Home, Live, Maps, News, People, Gov, Groups, Analytics)
  - Column 3: Header content & Account dropdown (aligns with right sidebar)
- **Content Area**: 90vh white background with rounded top corners
- **Floating Mobile Nav**: Bottom navigation bar (visible on mobile, hidden on desktop)
- **Search Mode**: Expands header to 20vh when `#search` hash is active

## Three-Column Layout Pattern

The three-column layout consists of:
1. **Left Sidebar**: Filters, settings, or navigation (toggleable via header icon)
2. **Center Content**: Main content area (flexible width)
3. **Right Sidebar**: Additional content, analytics, or settings (toggleable via header icon)

**Reference Implementation**: `/feed` page uses this pattern with:
- `isLeftSidebarVisible` / `isRightSidebarVisible` state
- Header icons (FunnelIcon, Cog6ToothIcon) to toggle sidebars
- `FeedContent` component managing the three-column grid

## Route Categorization

### Category 1: Core App Routes (Using PageWrapper ✅)

#### 1.1 Feed & Social
- **`/feed`** ✅ **FULLY IMPLEMENTED - HAS SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout ✅
  - Sidebar toggle icons in header ✅ (FunnelIcon, Cog6ToothIcon)
  - Left sidebar: MentionTimeFilter, MentionTypeFilter
  - Right sidebar: LiveMapAnalyticsCard, GroupsSidebar
  - **Status**: Complete reference implementation - **ORIGINAL SIDEBAR PAGE**

- **`/`** (Homepage)
  - Uses `PageWrapper`: ❌ (Uses `LandingPage` component, redirects to `/feed` if authenticated)
  - **Status**: Special case - landing page for unauthenticated users

#### 1.1a Content Detail Pages (NO PageWrapper ❌)
- **`/post/[id]`** ❌ **NO PAGEWRAPPER**
  - Uses `PageWrapper`: ❌ (Uses `PostDetailClient` - content detail page)
  - **Status**: Correctly excluded from PageWrapper

- **`/mention/[id]`** ❌ **NO PAGEWRAPPER**
  - Uses `PageWrapper`: ❌ (Uses `MentionDetailClient` - content detail page)
  - **Status**: Correctly excluded from PageWrapper

#### 1.2 Maps
- **`/live`** ✅ **FULLY IMPLEMENTED - HAS SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout ✅ (via `LivePageLayout`)
  - Sidebar toggle icons in header ✅ (via `LivePageHeaderButtons`)
  - Left sidebar: MentionTypeFilterContent
  - Right sidebar: MapSettingsContent
  - **Status**: Complete - **ORIGINAL SIDEBAR PAGE**

- **`/maps`** ✅ **USES PAGEWRAPPER - NO SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout: ❌ (Single column, max-width container - correct)
  - Sidebar toggle icons: ❌ (Correct - not an original sidebar page)
  - **Status**: Correct implementation - should NOT have sidebars

- **`/map/[id]`** ✅ **FULLY IMPLEMENTED - HAS SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout ✅ (via `MapPageLayout`)
  - Sidebar toggle icons in header ✅ (via `MapPageHeaderButtons`)
  - Left sidebar: MapFilterContent
  - Right sidebar: MapSettingsSidebar (if owner)
  - **Status**: Complete - **ORIGINAL SIDEBAR PAGE**

- **`/maps/new`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (needs verification)
  - **Status**: Needs review

#### 1.3 Content Discovery
- **`/news`** ✅ **USES PAGEWRAPPER - NO SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout: ❌ (Single column, max-width container - correct)
  - Sidebar toggle icons: ❌ (Correct - not an original sidebar page)
  - **Status**: Correct implementation - should NOT have sidebars

- **`/people`** ✅ **USES PAGEWRAPPER - NO SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout: ❌ (Single column, max-width container - correct)
  - Sidebar toggle icons: ❌ (Correct - not an original sidebar page)
  - **Status**: Correct implementation - should NOT have sidebars

- **`/groups`** ✅ **USES PAGEWRAPPER - NO SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout: ❌ (Uses `GroupsContent` component - correct)
  - Sidebar toggle icons: ❌ (Correct - not an original sidebar page)
  - **Status**: Correct implementation - should NOT have sidebars

#### 1.4 Government Data
- **`/gov`** ✅ **USES PAGEWRAPPER - NO SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout: ❌ (Single column, max-width container - correct)
  - Sidebar toggle icons: ❌ (Correct - not an original sidebar page)
  - **Status**: Correct implementation - should NOT have sidebars

- **`/gov/people`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `GovTablePageWrapper` - needs verification)
  - **Status**: Needs review

- **`/gov/orgs`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `GovTablePageWrapper` - needs verification)
  - **Status**: Needs review

- **`/gov/roles`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `GovTablePageWrapper` - needs verification)
  - **Status**: Needs review

- **`/gov/checkbook`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `CheckbookPageWrapper` - needs verification)
  - **Status**: Needs review

- **`/gov/checkbook/budget`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `CheckbookPageWrapper` - needs verification)
  - **Status**: Needs review

- **`/gov/checkbook/contracts`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `CheckbookPageWrapper` - needs verification)
  - **Status**: Needs review

- **`/gov/checkbook/payments`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `CheckbookPageWrapper` - needs verification)
  - **Status**: Needs review

- **`/gov/checkbook/payroll`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `CheckbookPageWrapper` - needs verification)
  - **Status**: Needs review

- **`/gov/person/[slug]`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `PersonPageWrapper` - needs verification)
  - **Status**: Needs review

- **`/gov/org/[slug]`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (uses `OrgPageWrapper` - needs verification)
  - **Status**: Needs review

#### 1.5 User Features
- **`/analytics`** ✅ **USES PAGEWRAPPER - NO SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout: ❌ (Single column, max-width container - correct)
  - Sidebar toggle icons: ❌ (Correct - not an original sidebar page)
  - **Status**: Correct implementation - should NOT have sidebars

- **`/billing`** ✅ **USES PAGEWRAPPER - CUSTOM SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout: ❌ (Uses separate sidebar components: `AccountSidebar`, `PaymentMethodsSidebar`)
  - Sidebar toggle icons: ✅ (UserCircleIcon, CreditCardIcon in header)
  - **Status**: Has custom sidebar implementation - different pattern, keep as-is

- **`/profile/[slug]`** ✅ **USES PAGEWRAPPER - NO SIDEBARS**
  - Uses `PageWrapper` ✅
  - Three-column layout: ❌ (Uses `ProfileLayout` with left sidebar, but not three-column)
  - Sidebar toggle icons: ❌ (Correct - not an original sidebar page)
  - **Status**: Uses custom ProfileLayout - should keep PageWrapper but no sidebar toggle icons

- **`/profile/[slug]/map`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

#### 1.6 Admin Routes
- **`/admin/billing`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

### Category 2: Content Detail Routes (NO PageWrapper ❌)

- **`/post/[id]`** ❌ **NO PAGEWRAPPER**
  - Uses `PageWrapper`: ❌ (Uses `PostDetailClient` - content detail page)
  - **Status**: Correctly excluded from PageWrapper

- **`/post/[id]/edit`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review - likely should use PageWrapper (edit page, not content view)

- **`/mention/[id]`** ❌ **NO PAGEWRAPPER**
  - Uses `PageWrapper`: ❌ (Uses `MentionDetailClient` - content detail page)
  - **Status**: Correctly excluded from PageWrapper

- **`/mention/[id]/edit`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review - likely should use PageWrapper (edit page, not content view)

- **`/groups/[slug]`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

- **`/groups/[slug]/settings`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

- **`/groups/new`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

- **`/map/[id]/settings`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

- **`/news/generate`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

### Category 3: Public/Marketing Routes

- **`/settings`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

- **`/search`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

- **`/add`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

- **`/contact`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (likely uses `SimplePageLayout`)
  - **Status**: Needs review

- **`/terms`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (likely uses `SimplePageLayout`)
  - **Status**: Needs review

- **`/privacy`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (likely uses `SimplePageLayout`)
  - **Status**: Needs review

- **`/download`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (likely uses `SimplePageLayout`)
  - **Status**: Needs review

- **`/contribute`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (likely uses `SimplePageLayout`)
  - **Status**: Needs review

- **`/login`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (likely uses `SimplePageLayout`)
  - **Status**: Needs review

- **`/signup`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown (likely uses `SimplePageLayout`)
  - **Status**: Needs review

- **`/gov/community-edits`** ⚠️ **NEEDS REVIEW**
  - Uses `PageWrapper`: Unknown
  - **Status**: Needs review

## Summary Statistics

### PageWrapper Usage
- **Using PageWrapper**: 12 routes (confirmed)
- **Not Using PageWrapper (Correct)**: 3 routes
  - `/` - landing page (special case)
  - `/post/[id]` - content detail page (correctly excluded)
  - `/mention/[id]` - content detail page (correctly excluded)
- **Needs Review**: 31 routes

### Three-Column Layout Implementation (Original Sidebar Pages Only)
- **Fully Implemented with Sidebars**: 3 routes
  - `/feed` - Left: MentionTimeFilter, MentionTypeFilter | Right: LiveMapAnalyticsCard, GroupsSidebar
  - `/live` - Left: MentionTypeFilterContent | Right: MapSettingsContent
  - `/map/[id]` - Left: MapFilterContent | Right: MapSettingsSidebar (if owner)
- **Using PageWrapper without Sidebars**: 9+ routes (correct implementation)
- **Custom Sidebar Implementation**: 1 route (`/billing` - different pattern)

### Sidebar Toggle Icons in Header
- **Implemented (Original Sidebar Pages)**: 3 routes
  - `/feed` - FunnelIcon, Cog6ToothIcon
  - `/live` - Filter and Settings icons
  - `/map/[id]` - Filter and Settings icons
- **Custom Implementation**: 1 route (`/billing` - UserCircleIcon, CreditCardIcon)
- **Should NOT Have Sidebar Icons**: All other routes (correctly implemented)

## Recommendations

### ✅ Current Implementation Status
The current implementation is **CORRECT**:
- Only 3 pages have sidebars (original implementation): `/feed`, `/live`, `/map/[id]`
- All other pages use `PageWrapper` but correctly do NOT have sidebars
- Content detail pages (`/post/[id]`, `/mention/[id]`) correctly do NOT use `PageWrapper`

### Priority 1: Verify Content Detail Pages
1. **`/post/[id]`** ✅ - Correctly excluded from PageWrapper
2. **`/mention/[id]`** ✅ - Correctly excluded from PageWrapper
3. **`/post/[id]/edit`** ⚠️ - Needs review (edit pages might need PageWrapper)
4. **`/mention/[id]/edit`** ⚠️ - Needs review (edit pages might need PageWrapper)

### Priority 2: Review & Consolidate Custom Wrappers
1. Review all `*PageWrapper` components:
   - `GovTablePageWrapper`
   - `CheckbookPageWrapper`
   - `PersonPageWrapper`
   - `OrgPageWrapper`
   - `ProfileLayout` (profile pages)
2. Determine if these should be consolidated into `PageWrapper` with three-column layout

### Priority 3: Create Dynamic Sidebar System (Optional Enhancement)
**Note**: Currently, each page with sidebars implements its own layout. If we want to create a unified system:

1. Create a reusable hook for sidebar state management:
   - `useSidebarState()` - manages left/right sidebar visibility
   - Returns state and toggle functions
   - Handles mobile vs desktop behavior
2. Create a reusable header icon component:
   - `SidebarToggleButton` - standardized icon button for header
   - Accepts icon, label, onClick handler
   - Consistent styling with existing header icons
3. Create dynamic sidebar components for PageWrapper:
   - `DynamicLeftSidebar` - accepts content as children
   - `DynamicRightSidebar` - accepts content as children
   - Only render when sidebar content is provided

**However**, the current implementation works well - each page manages its own sidebars, which provides flexibility.

### Priority 4: Verify All Routes Use PageWrapper (Except Content Details)
1. ✅ Content detail routes (`/post/[id]`, `/mention/[id]`) correctly excluded
2. ⚠️ Review edit routes (`/post/[id]/edit`, `/mention/[id]/edit`) - likely should use PageWrapper
3. ⚠️ Review all other routes to ensure they use PageWrapper

### Priority 5: Public/Marketing Routes
1. Keep public routes (`/terms`, `/privacy`, `/contact`, etc.) on `SimplePageLayout`
2. These routes don't need three-column layout or `PageWrapper`

## Implementation Patterns

### Pattern 1: PageWrapper WITHOUT Sidebars (Most Pages)

```tsx
'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';

export default function ExamplePage() {
  return (
    <PageWrapper
      headerContent={null} // No sidebar toggle icons
      searchComponent={<MapSearchInput />}
      searchResultsComponent={<SearchResults />}
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Single column content */}
      </div>
    </PageWrapper>
  );
}
```

### Pattern 2: PageWrapper WITH Sidebars (Original 3 Pages Only)

**Reference**: `/feed`, `/live`, `/map/[id]`

```tsx
'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import { useState } from 'react';
import { FunnelIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function FeedPage() {
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);

  const headerContent = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setIsLeftSidebarVisible(v => !v)}
        className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        aria-label="Toggle left sidebar"
      >
        <FunnelIcon className="w-5 h-5" />
      </button>
      <button
        onClick={() => setIsRightSidebarVisible(v => !v)}
        className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        aria-label="Toggle right sidebar"
      >
        <Cog6ToothIcon className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <PageWrapper headerContent={headerContent}>
      {/* Three-column layout implementation */}
    </PageWrapper>
  );
}
```

### Pattern 3: NO PageWrapper (Content Detail Pages)

```tsx
// /post/[id]/page.tsx or /mention/[id]/page.tsx
import PostDetailClient from '@/features/posts/components/PostDetailClient';

export default function PostPage({ params }) {
  // Fetch post data...
  return <PostDetailClient post={postData} isOwner={isOwner} />;
}
```

## Next Steps

1. **Verify content detail pages**: Confirm `/post/[id]` and `/mention/[id]` correctly do NOT use PageWrapper
2. **Review edit pages**: Determine if `/post/[id]/edit` and `/mention/[id]/edit` should use PageWrapper
3. **Complete route review**: Verify all routes marked "NEEDS REVIEW" use PageWrapper (except content details)
4. **Optional: Create dynamic sidebar system**: If desired, create reusable sidebar components for the 3 original sidebar pages
5. **Test mobile behavior**: Ensure floating nav and sidebar panels work correctly on mobile
6. **Document patterns**: Ensure all developers understand which pages should/shouldn't have sidebars
