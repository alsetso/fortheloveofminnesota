# Live Map Page Audit

## Component Inventory

### Core Map Components
1. **LiveMap** (`src/features/homepage/components/LiveMap.tsx`) - Main component (1644 lines)
2. **MapTopContainer** - Search, categories, account button
3. **MentionsLayer** - Renders mentions on map
4. **PointsOfInterestLayer** - POI layer
5. **CongressionalDistrictsLayer** - Districts layer
6. **CTUBoundariesLayer** - CTU boundaries
7. **StateBoundaryLayer** - State boundary
8. **CountyBoundariesLayer** - County boundaries

### Popups/Modals
1. **CreateMentionPopup** - Create mention form
2. **MapEntityPopup** - View mention details
3. **LayerRecordPopup** - View layer record (county/CTU/district/state)
4. **BottomButtonsPopup** - Bottom sheet for settings/analytics/collections
5. **CameraModal** - Camera capture
6. **LocationPermissionModal** - Location permission request
7. **LiveAccountModal** - Account modal (via MapTopContainer)
8. **MapStylesPopup** - Map styles (via MapTopContainer)
9. **DynamicSearchModal** - Dynamic search (via MapTopContainer)
10. **DailyWelcomeModal** - Daily welcome (via MapTopContainer)
11. **CameraImagePreview** - Floating preview after capture

### Hover Info Components
1. **CongressionalDistrictHoverInfo** - District hover info
2. **CTUHoverInfo** - CTU hover info
3. **CountyHoverInfo** - County hover info

### Other Components
1. **BottomButtons** - Bottom navigation
2. **MapSettingsContent** - Settings content in popup
3. **CollectionsManagement** - Collections management
4. **LivePageStats** - Analytics stats
5. **OnboardingDemo** - Onboarding walkthrough
6. **VisitorStats** - Visitor stats (imported but not used?)

## State Management Analysis

### Local State (LiveMap.tsx)
- Map state: `mapLoaded`, `mapError`, `mapInstanceRef`, `mentionsRefreshKey`
- Layer visibility: `showDistricts`, `showCTU`, `showStateBoundary`, `showCountyBoundaries`
- Hover states: `hoveredDistrict`, `hoveredCTU`, `hoveredState`, `hoveredCounty`
- Create form state: `createTabSelectedLocation`, `createTabAtlasMeta`, `createTabMapMeta`, `createTabFullAddress`
- Camera state: `isCameraOpen`, `capturedImageBlob`, `capturedImagePreview`, `waitingForLocation`
- Bottom buttons: `activeBottomButton`
- Time filter: `timeFilter`
- Location permission: `showLocationPermissionModal`
- Layer popup: `layerRecordPopup`
- UI state: `useBlurStyle`, `currentMapStyle`, `showDailyWelcome`, `hideMicrophone`, `showWelcomeTextOnly`
- Refs: `hoveredMentionIdRef`, `isHoveringMentionRef`, `temporaryMarkerRef`, `isTransitioningToCreateRef`

### Modal State (useLivePageModals)
- Unified modal state management
- Types: `account`, `mapStyles`, `dynamicSearch`, `popup-*`, `create`, `contribute`, `tools`

### External State
- `useAuthStateSafe()` - Auth state
- `useAppModalContextSafe()` - Global modals
- `useLocation()` - Location hook
- `useUrlMapState()` - URL state

## Issues Identified

### 1. Duplicate State Management
- `useBlurStyle` and `currentMapStyle` are managed both locally and via window events
- Modal state split between `useLivePageModals` and local state (`showLocationPermissionModal`, `layerRecordPopup`)
- Bottom button state (`activeBottomButton`) separate from modal system

### 2. Over-Engineered Patterns
- Multiple refs for auth state (`userRef`, `authLoadingRef`, `openWelcomeRef`) when hooks already provide latest
- Complex marker management with `temporaryMarkerRef` and `isTransitioningToCreateRef`
- Window event system for communication between components (could use context/state)

### 3. Unused/Dead Code
- `VisitorStats` imported but not rendered
- `Map3DControlsSecondaryContent` imported but not used
- `DailyWelcomeModal` imported but handled in MapTopContainer
- `usePathname` imported but not used
- `initializedRef` set but never checked meaningfully

### 4. Inconsistencies
- Some modals use `useLivePageModals`, others use local state
- Marker creation logic duplicated (white pin vs red pin transformation)
- Location permission handled separately from other modals

### 5. Performance Issues
- Multiple `useEffect` hooks that could be consolidated
- Event listeners added/removed on every render in some cases
- Large click handler (lines 708-1137) that could be extracted

### 6. Code Organization
- 1644 line component - too large, should be split
- Complex click handler with nested async operations
- Marker management logic scattered across multiple effects

## Detailed Issues

### 1. Duplicate Marker Management Logic
**Location:** Lines 367-494 and 588-629
- Two separate `useEffect` hooks managing the same `temporaryMarkerRef`
- First effect (367-494): Creates preview marker with account image
- Second effect (588-629): Maintains red pin when create sheet is open
- **Issue:** Both effects run on same dependencies, causing redundant work
- **Fix:** Consolidate into single effect with clear state machine

### 2. Window Event System Overuse
**Count:** 24 window event listeners in LiveMap.tsx, 129+ across layout components
- Events used: `mention-created`, `mention-click`, `show-location-for-mention`, `mention-hover-*`, `blur-style-change`, `map-style-change`, `live-account-modal-change`, `map-location-click`, `update-search-address`, `mention-time-filter-change`
- **Issue:** Tight coupling via global events, hard to trace data flow
- **Fix:** Use React Context or state management for cross-component communication

### 3. Unused Imports
- `Map3DControlsSecondaryContent` - imported but never used
- `DailyWelcomeModal` - imported but handled in MapTopContainer
- `VisitorStats` - imported but not rendered
- `usePathname` - imported but never used
- `initializedRef` - set but never meaningfully checked

### 4. Unnecessary Auth Refs
**Location:** Lines 307-317
- `userRef`, `authLoadingRef`, `openWelcomeRef` maintained via useEffect
- **Issue:** Hooks already provide latest values, refs add complexity
- **Fix:** Use hooks directly in callbacks or use `useCallback` with dependencies

### 5. Complex Click Handler
**Location:** Lines 708-1137 (429 lines)
- Single massive click handler with nested async operations
- Handles: mention detection, layer queries, reverse geocoding, marker creation, zoom
- **Issue:** Hard to test, maintain, and debug
- **Fix:** Extract to separate hook `useMapClickHandler`

### 6. Duplicate State Patterns
- `useBlurStyle` and `currentMapStyle` managed locally AND via window events
- Modal state split: some in `useLivePageModals`, others local (`showLocationPermissionModal`, `layerRecordPopup`)
- Bottom button state (`activeBottomButton`) separate from modal system

### 7. Marker Creation Duplication
- White pin creation (lines 971-1052)
- Red pin transformation (lines 558-578, 616-626)
- Preview marker creation (lines 380-472)
- **Issue:** Similar logic repeated with slight variations
- **Fix:** Create unified `useMapMarker` hook

### 8. Effect Consolidation Opportunities
- Lines 231-245: Blur/style listeners (could combine)
- Lines 326-344: Mention event listeners (could combine)
- Lines 346-364: Account modal listener (could combine with modal system)
- Lines 367-494 and 588-629: Marker management (definitely duplicate)

### 9. Component Size
- LiveMap.tsx: 1644 lines (should be < 500)
- MapTopContainer.tsx: 1274+ lines
- **Issue:** Too large to maintain effectively
- **Fix:** Split into feature-based components

## Refactoring Recommendations

### Phase 1: Remove Dead Code
1. Remove unused imports: `Map3DControlsSecondaryContent`, `DailyWelcomeModal`, `VisitorStats`, `usePathname`
2. Remove `initializedRef` (no meaningful use)
3. Remove auth refs (`userRef`, `authLoadingRef`, `openWelcomeRef`)

### Phase 2: State Consolidation
1. Move `showLocationPermissionModal` to `useLivePageModals`
2. Move `layerRecordPopup` to `useLivePageModals`
3. Move `activeBottomButton` to `useLivePageModals` or create `useBottomButtons` hook
4. Consolidate UI state (blur, map style) into `useMapUIState` hook
5. Remove window event dependencies for blur/style (use context)

### Phase 3: Extract Custom Hooks
1. `useMapClickHandler` - Extract click handler logic (lines 708-1137)
2. `useMapMarker` - Unified marker management (consolidate lines 367-494, 588-629, 971-1052)
3. `useLayerPopup` - Layer record popup logic
4. `useMapEventListeners` - Consolidate all window event listeners

### Phase 4: Component Splitting
1. Split LiveMap into:
   - `LiveMapContainer` - Main wrapper
   - `LiveMapLayers` - All layer components
   - `LiveMapModals` - All modal components
   - `LiveMapOverlays` - Hover info, stats, etc.
2. Split MapTopContainer into smaller components

### Phase 5: Replace Window Events with Context
1. Create `LiveMapContext` for cross-component communication
2. Replace window events with context methods
3. Keep window events only for external integrations (if needed)

### Phase 6: Performance Optimization
1. Memoize expensive callbacks with `useCallback`
2. Consolidate related `useEffect` hooks
3. Use `React.memo` for layer components
4. Optimize marker creation (avoid DOM manipulation in effects)
