# Homepage Map System - Complete File Analysis

## Overview
This document lists all files, services, components, and dependencies used by the homepage map system (`FeedMapClient`).

## Entry Point
- **Route**: `/` (homepage)
- **Page Component**: `src/app/page.tsx`
- **Client Component**: `src/components/feed/FeedMapClient.tsx`

---

## Core Components Used by Homepage Map

### 1. Main Map Component
- `src/components/feed/FeedMapClient.tsx` - Main homepage map client component

### 2. UI Components
- `src/components/feed/TopNav.tsx` - Top navigation bar
- `src/components/feed/MapControls.tsx` - Map controls (zoom, 3D toggle, find me)
- `src/components/feed/LocationSidebar.tsx` - Left sidebar with search and location details
- `src/components/feed/WelcomeModal.tsx` - Welcome/sign-in modal
- `src/components/feed/AccountModal.tsx` - Account settings modal
- `src/components/feed/useHomepageState.ts` - Centralized state management hook

### 3. Map Layer Components (from _archive)
- `src/components/_archive/map/PinsLayer.tsx` - Pin visualization layer
- `src/components/_archive/map/CreatePinModal.tsx` - Pin creation modal

---

## Services & Utilities Used

### Map Configuration & Loading
- `src/features/_archive/map/config.ts` - Map configuration (MAP_CONFIG)
- `src/features/_archive/map/utils/mapboxLoader.ts` - Mapbox GL loader utility

### Map Pin Services (from _archive)
- `src/features/_archive/map-pins/services/publicMapPinService.ts` - Public map pins CRUD operations
- `src/features/_archive/map-pins/services/locationLookupService.ts` - Location lookup (city/county IDs)

### Types
- `src/types/mapbox-events.ts` - Mapbox event types (MapboxMapInstance, etc.)
- `src/types/map-pin.ts` - Map pin types

---

## Dependencies Chain

### FeedMapClient → PinsLayer
```
FeedMapClient.tsx
  └─> PinsLayer (from @/components/_archive/map/PinsLayer)
      └─> PublicMapPinService (from @/features/_archive/map-pins/services/publicMapPinService)
          └─> supabase client
          └─> types/map-pin.ts
```

### FeedMapClient → CreatePinModal
```
FeedMapClient.tsx
  └─> CreatePinModal (from @/components/_archive/map/CreatePinModal)
      └─> PublicMapPinService (from @/features/_archive/map-pins/services/publicMapPinService)
      └─> LocationLookupService (from @/features/_archive/map-pins/services/locationLookupService)
          └─> supabase client
          └─> MAP_CONFIG
```

### FeedMapClient → LocationSidebar
```
FeedMapClient.tsx
  └─> LocationSidebar.tsx
      └─> MAP_CONFIG
      └─> loadMapboxGL
      └─> types/mapbox-events.ts
```

---

## Unused Duplicate Files (Can Be Archived)

### Newer Versions Not Used Anywhere
These files exist but are **NOT** imported by the homepage or any active routes:

1. **Components**:
   - `src/components/map/PinsLayer.tsx` - Newer version (uses newer service)
   - `src/components/map/CreatePinModal.tsx` - Newer version (uses newer service)

2. **Services**:
   - `src/features/map-pins/services/publicMapPinService.ts` - Newer version
   - `src/features/map-pins/services/locationLookupService.ts` - (if exists, check)

### Why They're Unused
- Homepage uses: `@/components/_archive/map/PinsLayer` and `@/components/_archive/map/CreatePinModal`
- Archived map page (`/app/_archive/map/map/`) also uses archived versions
- No active routes import from `@/components/map/` or `@/features/map-pins/`

---

## Files That Should Stay Active

### Core Map Infrastructure (Used by Multiple Features)
- `src/features/_archive/map/config.ts` - Used by homepage, feed posts, location sidebar
- `src/features/_archive/map/utils/mapboxLoader.ts` - Used by homepage, feed posts, location sidebar
- `src/types/mapbox-events.ts` - Used throughout
- `src/types/map-pin.ts` - Used throughout

### Feed-Specific Components (Used by Homepage)
All files in `src/components/feed/` that are imported by `FeedMapClient.tsx`:
- TopNav.tsx
- MapControls.tsx
- LocationSidebar.tsx
- WelcomeModal.tsx
- AccountModal.tsx
- useHomepageState.ts

### Archived Components (Used by Homepage)
- `src/components/_archive/map/PinsLayer.tsx` - Active use
- `src/components/_archive/map/CreatePinModal.tsx` - Active use

### Archived Services (Used by Homepage)
- `src/features/_archive/map-pins/services/publicMapPinService.ts` - Active use
- `src/features/_archive/map-pins/services/locationLookupService.ts` - Active use

---

## Other Map-Related Files (Not Used by Homepage)

These are used by other features (feed posts, archived map page, etc.) but NOT by homepage:

### Feed Post Map Features
- `src/components/feed/PostMapModal.tsx` - Post map editor
- `src/components/feed/PostMapRenderer.tsx` - Post map display
- `src/components/feed/utils/mapStaticImage.ts` - Static map image generation
- `src/components/feed/hooks/usePostMapBase.ts` - Post map base hook

### Archived Map Page
- `src/app/_archive/map/map/MapContent.tsx` - Full map page
- `src/components/_archive/map/UserPinsList.tsx` - User pins list
- `src/components/_archive/map/MapToolbar.tsx` - Map toolbar
- `src/components/_archive/map/CreateMapModal.tsx` - Create map modal
- All other files in `src/components/_archive/map/` not listed above

### Other Archived Map Features
- All files in `src/features/_archive/map/` (hooks, controllers, services, etc.)
- All files in `src/features/_archive/map-pins/hooks/`
- `src/features/_archive/map-pins/services/mapPinService.ts` - User-specific pin service

---

## Summary

### Homepage Map System Uses:
1. **7 feed components** (TopNav, MapControls, LocationSidebar, WelcomeModal, AccountModal, useHomepageState, FeedMapClient)
2. **2 archived map components** (PinsLayer, CreatePinModal)
3. **2 map utilities** (config.ts, mapboxLoader.ts)
4. **2 archived services** (publicMapPinService.ts, locationLookupService.ts)
5. **2 type files** (mapbox-events.ts, map-pin.ts)

### Can Be Archived (Unused Duplicates):
1. `src/components/map/PinsLayer.tsx`
2. `src/components/map/CreatePinModal.tsx`
3. `src/features/map-pins/services/publicMapPinService.ts`
4. `src/features/map-pins/services/locationLookupService.ts` (if exists)

### Total Files Used by Homepage: ~15 files
### Total Map-Related Files in Codebase: ~90+ files




