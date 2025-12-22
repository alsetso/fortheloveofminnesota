# Sidebar Tab URL Parameters

## Overview

The sidebar uses URL parameters to manage tab state for hash-based tabs (Mentions, Controls) on the homepage. This enables shareable links and browser back/forward navigation.

## URL Parameter

### `tab` Parameter
- **Format**: `?tab=mentions|controls`
- **Scope**: Only active on homepage (`/`)
- **Behavior**: 
  - When tab is active, URL shows `?tab=tabname`
  - When URL has `?tab=tabname`, tab opens automatically
  - Only hash-based tabs use URL params
  - Route-based tabs (`/explore`, `/civic`) use pathname, not URL params

## Tab Types

### Hash-Based Tabs (Use URL Params)
- **Mentions** (`#mentions`) → `?tab=mentions`
- **Controls** (`#controls`) → `?tab=controls`

### Route-Based Tabs (Use Pathname)
- **Explore** (`/explore`) → Navigates to route
- **Civic** (`/civic`) → Navigates to route
- **People** (`/profile`) → Navigates to route

## Implementation

### Files

1. **`src/components/sidebar/hooks/useSidebarTabState.ts`**
   - Hook that manages tab URL parameter
   - Provides `urlTab` and `updateUrl` function
   - Only handles hash-based tabs on homepage

2. **`src/components/sidebar/Sidebar.tsx`**
   - Main sidebar component
   - Syncs tab state with URL parameters
   - Handles both desktop and mobile views

### Behavior

1. **Opening Tab**: 
   - User clicks hash-based tab → `updateUrl(tab)` → URL shows `?tab=tabname`
   
2. **Closing Tab**:
   - User closes tab → `updateUrl(null)` → URL param removed
   
3. **URL Navigation**:
   - User visits `/?tab=mentions` → Tab opens automatically
   - User removes `?tab=mentions` from URL → Tab closes

4. **Route-Based Tabs**:
   - Clicking `/explore` or `/civic` navigates to that route
   - If already on that route, clicking again toggles secondary sidebar
   - No URL parameter used (pathname handles state)

## Example URLs

- `/` - Homepage, no tab open
- `/?tab=mentions` - Homepage with Mentions tab open
- `/?tab=controls` - Homepage with Controls tab open
- `/?tab=mentions&year=2024` - Mentions tab + year filter
- `/explore` - Explore route (no URL param needed)
- `/civic` - Civic route (no URL param needed)

## Notes

- URL parameters only work on homepage (`pathname === '/'`)
- Route-based tabs don't use URL params (they use pathname)
- Hash-based tabs require URL params for shareable links
- Tab state syncs bidirectionally: URL ↔ Tab state

