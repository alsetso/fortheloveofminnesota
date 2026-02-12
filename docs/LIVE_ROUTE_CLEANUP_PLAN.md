# `/live` Route Cleanup Plan

## Overview
Remove `/live` route and redirect all references to `/maps` (which shows the live map by default).

## ✅ COMPLETED CLEANUP

### 1. ✅ DELETE - Route Files
- [x] `src/app/live/page.tsx` - **DELETED**

### 2. ✅ UPDATE - Route Redirects
- [x] `src/app/map/page.tsx` - Changed redirect from `/map/live` → `/maps`
- [x] `src/middleware.ts` - Updated deprecated route redirects from `/live` → `/maps` + added `/live` → `/maps` redirect
- [x] `src/app/map/[id]/page.tsx` - Updated `/map/live` redirect to `/maps`

### 3. ✅ UPDATE - Direct Route References (Changed `/live` → `/maps`)
- [x] `src/features/homepage/components/PinActivityFeed.tsx` - Updated links to `/maps`
- [x] `src/components/layout/MentionTypeInfoCard.tsx` - Updated `router.push('/maps')`
- [x] `src/components/layout/HeaderMentionTypeCards.tsx` - Updated `router.replace('/maps')`
- [x] `src/features/homepage/components/MentionTypeCards.tsx` - Updated `router.push('/maps')`
- [x] `src/features/homepage/components/HomeDashboardContent.tsx` - Updated `href="/maps"`
- [x] `src/features/profiles/components/ProfileMentionsList.tsx` - Updated to return `/maps?pin=`
- [x] `src/features/mentions/components/MentionDetailClient.tsx` - Updated all `/live` references to `/maps`
- [x] `src/components/landing/LandingPage.tsx` - Updated `router.push('/maps')` and `href="/maps"`
- [x] `src/app/components/HomeAnalyticsSidebar.tsx` - Updated `href="/maps"`
- [x] `src/features/homepage/components/HomepageMapView.tsx` - Updated `href="/maps"`

### 4. ✅ UPDATE - Pathname Checks (Changed `pathname === '/live'` → `pathname === '/maps'`)
- [x] `src/features/map/components/MentionsLayer.tsx` - Updated `isLiveMap` check
- [x] `src/middleware.ts` - Updated auth check for `/maps`
- [x] `src/app/contribute/ContributePageContent.tsx` - Updated all pathname checks
- [x] `src/components/auth/ProtectedRouteGuard.tsx` - Updated pathname check
- [x] `src/features/account/components/WelcomeModal.tsx` - Updated `isLivePage` check
- [x] `src/app/map/[id]/components/ContributeOverlay.tsx` - Updated pathname checks
- [x] `src/components/layout/MapTopContainer.tsx` - Updated pathname check
- [x] `src/components/layout/BottomButtons.tsx` - Updated `isLivePage` check
- [x] `src/features/homepage/hooks/useLiveUrlState.ts` - Updated all pathname checks

### 5. ✅ UPDATE - Comments/Documentation (Updated references in comments)
- [x] `src/app/map/[id]/page.tsx` - Updated all comments mentioning `/live` → `/maps`
- [x] `src/app/map/[id]/components/MapIDBox.tsx` - Updated all comments mentioning `/live` → `/maps`
- [x] `src/app/map/[id]/hooks/useUnifiedMapClickHandler.ts` - Updated comments
- [x] `src/app/map/[id]/components/BoundaryLayersManager.tsx` - Updated comments
- [x] `src/app/map/[id]/hooks/useMapboxMap.ts` - Updated comments
- [x] `src/app/map/[id]/hooks/useEntitySidebar.ts` - Updated comments
- [x] `src/features/map/components/MentionsLayer.tsx` - Updated comments
- [x] `src/features/map/components/CTUBoundariesLayer.tsx` - Updated comments
- [x] `src/features/map/components/CountyBoundariesLayer.tsx` - Updated comments
- [x] `src/features/map/components/StateBoundaryLayer.tsx` - Updated comments
- [x] `src/components/layout/LiveMapFooterStatus.tsx` - Updated comments
- [x] `src/components/layout/AppMenu.tsx` - Updated comments
- [x] `src/contexts/HeaderThemeContext.tsx` - Updated comments
- [x] `src/components/layout/MapTopContainer.tsx` - Updated comments
- [x] `src/components/layout/MapEntityPopup.tsx` - Updated comments
- [x] `src/components/layout/LivePageStats.tsx` - Updated comments
- [x] `src/components/layout/AppContainer.tsx` - Updated to note it's legacy

### 6. UPDATE - CSS Classes (Remove live-map-page classes)
- [ ] `src/app/globals.css` - Remove `.live-map-page` styles (if not used elsewhere)

### 7. KEEP - API Routes (These reference the map slug, not the route)
- ✅ `src/app/api/maps/live/*` - Keep all API routes (they reference map slug='live')
- ✅ `src/components/maps/AdminViewToggle.tsx` - API calls are fine
- ✅ `src/app/maps/page.tsx` - API calls are fine

### 8. KEEP - Component Names (These are descriptive, not route-specific)
- ✅ `LiveMapLeftSidebar` - Component name is fine
- ✅ `LiveMapRightSidebar` - Component name is fine
- ✅ `LiveMapFooterStatus` - Component name is fine
- ✅ `LivePinCard` - Component name is fine
- ✅ `LiveSearch` - Component name is fine
- ✅ `liveBoundaryCache` - Service name is fine

### 9. ✅ UPDATE - Analytics (Updated URL references)
- [x] `src/app/api/analytics/homepage-stats/route.ts` - Changed `/live` → `/maps` in queries
- [x] `src/features/homepage/components/RecentAccountActivity.tsx` - Updated activity label

### 10. ✅ UPDATE - Post Links (Changed `/map/live` → `/maps`)
- [x] `src/features/posts/components/PostDetailClient.tsx` - Updated all `href="/maps"`

## Migration Strategy

1. **First**: Update middleware to redirect `/live` → `/maps`
2. **Second**: Update all direct route references
3. **Third**: Update pathname checks
4. **Fourth**: Update comments/documentation
5. **Last**: Delete the `/live` page file

## Notes

- API routes `/api/maps/live/*` should remain unchanged (they reference the map with slug='live')
- Component names with "Live" prefix are fine (they're descriptive)
- The `/maps` page already shows the live map by default, so functionality is preserved
