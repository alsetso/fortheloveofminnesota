# Custom Map Page Refactor Analysis

## Overview
Comprehensive analysis of the custom map page (`/map/[id]`) to identify consolidation, refactoring, and simplification opportunities without losing functionality.

---

## Page Structure

### Main Files
- **`src/app/map/[id]/page.tsx`** (1059 lines) - Main page component with 47+ hooks/state variables
- **`src/app/map/[id]/MapPageLayout.tsx`** (57 lines) - Layout wrapper
- **`src/app/map/[id]/MapPageHeaderButtons.tsx`** (73 lines) - Header button controls

### Core Components
- **`MapIDBox.tsx`** (1547+ lines) - Main map container with Mapbox integration
- **`MapSettingsSidebar.tsx`** (2100+ lines) - Settings management
- **`JoinMapSidebar.tsx`** (447 lines) - Membership join flow
- **`MapPosts.tsx`** (105 lines) - Posts sidebar
- **`ContributeOverlay.tsx`** (1667+ lines) - Contribution modal overlay
- **`MemberManager.tsx`** - Member management
- **`MapEntitySlideUp.tsx`** - Entity detail view

### Hooks
- **`useMapMembership.ts`** (143 lines) - Membership state management
- **`useMapboxMap.ts`** - Mapbox instance management
- **`useClickMarker.ts`** (147 lines) - Click marker visualization
- **`useReverseGeocode.ts`** - Reverse geocoding
- **`useUnifiedSidebar.ts`** - Sidebar state management

### API Routes
- `/api/maps/[id]/data` - Aggregate endpoint (map + stats + pins + areas + members)
- `/api/maps/[id]/members` - Member management
- `/api/maps/[id]/membership-requests` - Join requests
- `/api/maps/[id]/pins` - Pins CRUD
- `/api/maps/[id]/areas` - Areas CRUD
- `/api/maps/[id]/stats` - View statistics

---

## Feature Categories

### 1. Map Rendering & Layers
**Files:**
- `MapIDBox.tsx` (map container)
- `MentionsLayer.tsx` (1498 lines - mentions visualization)
- Boundary layers: `CongressionalDistrictsLayer`, `CTUBoundariesLayer`, `StateBoundaryLayer`, `CountyBoundariesLayer`
- `useMapboxMap.ts` hook

**Features:**
- Mapbox GL JS integration
- Multiple map styles (street, satellite, light, dark)
- Boundary layer toggles (districts, CTU, state, counties)
- Mentions layer with real-time updates
- Pin/area visualization
- Building extrusions
- Terrain rendering

**Issues:**
- `MentionsLayer.tsx` is extremely large (1498 lines) - needs splitting
- Multiple boundary layer components with similar patterns
- Map instance management scattered across components

---

### 2. User Assistance & Interactions

#### A. Click Interactions
**Files:**
- `page.tsx` (lines 399-549) - Map click handler
- `useClickMarker.ts` - Click marker hook
- `LocationSelectPopup` component
- `useReverseGeocode.ts` hook

**Features:**
- Map click detection
- Reverse geocoding on click
- Click marker visualization
- Location select popup
- Minnesota bounds validation
- Map feature querying at click point

**Issues:**
- Click handler logic embedded in page component (150+ lines)
- Multiple state variables for click handling (`locationSelectPopup`, `clickedCoordinates`, `reverseGeocodeAddress`)
- Reverse geocode hook called separately from click handler
- Click marker management split between hook and page

#### B. Pin/Area Creation
**Files:**
- `MapIDBox.tsx` - Pin/area mode toggles
- `MapPinForm.tsx` - Pin creation form
- `MapAreaDrawModal.tsx` - Area drawing modal
- `CollaborationToolsNav.tsx` - Tool selection UI

**Features:**
- Pin mode toggle
- Area draw mode
- Permission checks before actions
- Plan-based restrictions
- Role-based overrides

**Issues:**
- Permission checks duplicated (`handlePinAction`, `handleAreaAction`, `handlePostAction`)
- Tool state management (`activeTool`, `pinMode`, `showAreaDrawModal`) could be unified
- Multiple permission check functions with similar logic

#### C. Search & Navigation
**Files:**
- `MapSearchInput.tsx` - Search component
- `SearchResults.tsx` - Results display
- `MapFilterContent.tsx` - Filter sidebar

**Features:**
- Location search
- Map fly-to on selection
- Filter sidebar (time, map styles, global layers)

**Issues:**
- Search logic separate from map interactions
- Filter state managed in page component

---

### 3. Membership & Permissions

#### A. Membership Management
**Files:**
- `useMapMembership.ts` - Membership hook
- `MemberManager.tsx` - Member management UI
- `JoinMapSidebar.tsx` - Join flow
- `MapMembershipRequests.tsx` - Request management

**Features:**
- Membership status checking
- Role determination (owner/manager/editor)
- Join request flow
- Auto-approve logic
- Membership questions/rules
- Member limit enforcement

**Issues:**
- Membership check happens in multiple places
- `useMapMembership` hook has complex logic for initialMembers handling
- Join sidebar has confetti animation (could be extracted)
- Membership toast shown in page component (lines 256-305)

#### B. Permission System
**Files:**
- `src/lib/maps/permissions.ts` - Permission checking logic
- `page.tsx` (lines 171-253) - Permission handlers

**Features:**
- Plan-based restrictions (hobby/contributor/professional/business)
- Role-based overrides (managers/editors)
- Action-specific permissions (pins/areas/posts/clicks)
- Subscription status checks
- Upgrade prompts

**Issues:**
- Three nearly identical permission handlers (`handlePinAction`, `handleAreaAction`, `handlePostAction`)
- Permission check logic duplicated in multiple components
- Upgrade prompt state managed in page component
- Permission denied events via custom events (lines 104-119)

---

### 4. Sidebar System

**Files:**
- `useUnifiedSidebar.ts` - Sidebar state hook
- `UnifiedSidebarContainer.tsx` - Container component
- `MapPageLayout.tsx` - Layout wrapper
- Individual sidebar components

**Features:**
- Unified sidebar system (filter, settings, members, join, posts)
- Mobile/desktop responsive behavior
- Sidebar configs built dynamically (lines 574-713)
- Auto-close on navigation

**Issues:**
- Sidebar configs built in page component (140+ lines)
- Each sidebar type has separate component
- Sidebar state management could be simplified
- Map resize on sidebar toggle (lines 558-571) - debounced but could be optimized

---

### 5. Data Fetching & State

**Files:**
- `page.tsx` (lines 735-812) - Data fetching
- `/api/maps/[id]/data` - Aggregate endpoint

**Features:**
- Single aggregate endpoint (map + stats + pins + areas + members)
- Initial data loading
- View count recording
- URL normalization (UUID → slug)
- Session tracking

**Issues:**
- Multiple state variables for related data (`mapData`, `initialPins`, `initialAreas`, `initialMembers`)
- View recording happens in fetch effect (could be separate)
- URL normalization effect separate from data fetch
- Session ID management in component (could be utility)

---

### 6. Settings Management

**Files:**
- `MapSettingsSidebar.tsx` (2100+ lines) - Settings UI
- `/api/maps/[id]/route.ts` - Update endpoint

**Features:**
- Basic settings (name, description, slug, visibility)
- Appearance settings (map style, layers, emoji, meta)
- Collaboration settings (allow pins/areas/posts/clicks, permissions)
- Presentation settings (hide creator, featured, filters icon)
- Membership settings (auto-approve, rules, questions)
- Categories management
- Boundary configuration

**Issues:**
- Extremely large component (2100+ lines)
- Multiple collapsible sections with similar patterns
- Form state management complex
- Settings update logic embedded in component

---

### 7. Posts Integration

**Files:**
- `MapPosts.tsx` (105 lines) - Posts sidebar
- `PostCreationForm.tsx` - Post creation
- `/api/posts` - Posts API

**Features:**
- Posts list for map
- Post creation inline
- Feed-style display

**Issues:**
- Relatively simple, but integrated into sidebar system
- Post creation form duplicated from feed

---

### 8. Contribute Overlay

**Files:**
- `ContributeOverlay.tsx` (1667+ lines) - Full-screen contribution modal

**Features:**
- Mention type selection
- Location input (lat/lng or search)
- Media upload (image/video)
- Tag others
- Collection assignment
- Map meta capture
- Success screen with confetti

**Issues:**
- Extremely large component (1667+ lines)
- Many state variables (20+)
- Complex form logic
- Media upload logic embedded
- Tag search logic embedded
- Collection selection embedded

---

## Consolidation Opportunities

### 1. State Management Consolidation

**Current Issues:**
- 47+ useState/useEffect/useCallback/useMemo hooks in `page.tsx`
- Related state scattered (e.g., click handling: `locationSelectPopup`, `clickedCoordinates`, `reverseGeocodeAddress`)
- Permission state duplicated across handlers

**Recommendations:**
- **PAGE-SPECIFIC:** Create `useMapPageState` hook to consolidate:
  - Map data state (`mapData`, `initialPins`, `initialAreas`, `initialMembers`)
  - Click interaction state (`locationSelectPopup`, `clickedCoordinates`)
  - Permission state (`upgradePrompt`)
  - Filter state (`timeFilter`, boundary toggles)
- **PAGE-SPECIFIC:** Create `useMapClickHandler` hook to consolidate:
  - Click detection
  - Reverse geocoding
  - Click marker management
  - Location popup state
- **GLOBAL:** Consider Zustand/Jotai for complex shared state (if used elsewhere)

---

### 2. Permission System Consolidation

**Current Issues:**
- Three identical permission handlers (`handlePinAction`, `handleAreaAction`, `handlePostAction`)
- Permission check logic duplicated
- Upgrade prompt state in page component

**Recommendations:**
- **PAGE-SPECIFIC:** Create `useMapPermissions` hook:
  - Single permission check function with action parameter
  - Unified upgrade prompt state
  - Permission denied event handling
- **GLOBAL:** Enhance `src/lib/maps/permissions.ts`:
  - Add hook wrapper for React components
  - Add permission denied event emitter utility

---

### 3. Sidebar Configuration Consolidation

**Current Issues:**
- Sidebar configs built inline in page component (140+ lines)
- Config logic mixed with component logic

**Recommendations:**
- **PAGE-SPECIFIC:** Extract `useMapSidebarConfigs` hook:
  - Build sidebar configs based on membership/permissions
  - Return memoized config array
  - Handle conditional sidebar visibility

---

### 4. Component Size Reduction

**Current Issues:**
- `MentionsLayer.tsx` - 1498 lines
- `MapSettingsSidebar.tsx` - 2100+ lines
- `ContributeOverlay.tsx` - 1667+ lines
- `MapIDBox.tsx` - 1547+ lines

**Recommendations:**

#### A. MentionsLayer.tsx
- **PAGE-SPECIFIC:** Split into:
  - `MentionsLayer.tsx` (main component, ~300 lines)
  - `useMentionsData.ts` (data fetching/hooks, ~400 lines)
  - `useMentionsMapbox.ts` (Mapbox layer management, ~400 lines)
  - `MentionsPopup.tsx` (popup component, ~200 lines)
  - `MentionsHighlight.tsx` (highlight layer, ~100 lines)

#### B. MapSettingsSidebar.tsx
- **PAGE-SPECIFIC:** Split into:
  - `MapSettingsSidebar.tsx` (main container, ~200 lines)
  - `BasicSettingsSection.tsx` (~150 lines)
  - `AppearanceSettingsSection.tsx` (~200 lines)
  - `CollaborationSettingsSection.tsx` (~250 lines)
  - `PresentationSettingsSection.tsx` (~150 lines)
  - `MembershipSettingsSection.tsx` (~200 lines)
  - `CategoriesSettingsSection.tsx` (~150 lines)
  - `useMapSettingsForm.ts` (form state/handlers, ~300 lines)

#### C. ContributeOverlay.tsx
- **PAGE-SPECIFIC:** Split into:
  - `ContributeOverlay.tsx` (main container, ~200 lines)
  - `MentionTypeSelector.tsx` (~150 lines)
  - `LocationInputSection.tsx` (~200 lines)
  - `MediaUploadSection.tsx` (~250 lines)
  - `TagOthersSection.tsx` (~200 lines)
  - `CollectionSelector.tsx` (~150 lines)
  - `ContributeSuccessScreen.tsx` (~100 lines)
  - `useContributeForm.ts` (form state/handlers, ~400 lines)

#### D. MapIDBox.tsx
- **PAGE-SPECIFIC:** Split into:
  - `MapIDBox.tsx` (main container, ~300 lines)
  - `MapboxMapContainer.tsx` (Mapbox instance, ~200 lines)
  - `MapLayersManager.tsx` (boundary layers, ~200 lines)
  - `MapInteractionHandlers.tsx` (click/pin/area handlers, ~300 lines)
  - `MapInfoCard.tsx` (info display, ~200 lines)
  - `CollaborationTools.tsx` (tool buttons, ~150 lines)

---

### 5. API Call Consolidation

**Current Issues:**
- Some endpoints called separately (membership requests check)
- View recording in fetch effect

**Recommendations:**
- **PAGE-SPECIFIC:** Already using aggregate `/api/maps/[id]/data` endpoint (good)
- **PAGE-SPECIFIC:** Move view recording to separate effect/hook
- **PAGE-SPECIFIC:** Consider including pending request status in data endpoint

---

### 6. Hook Consolidation

**Current Issues:**
- Multiple hooks for related functionality
- Some hooks are thin wrappers

**Recommendations:**
- **PAGE-SPECIFIC:** Combine `useClickMarker` and click handler logic into `useMapClickHandler`
- **GLOBAL:** Review `useReverseGeocode` - could be part of click handler hook
- **PAGE-SPECIFIC:** Create `useMapInteractions` hook combining:
  - Click handling
  - Pin mode
  - Area draw mode
  - Permission checks

---

### 7. Boundary Layer Consolidation

**Current Issues:**
- Four separate boundary layer components with similar patterns
- State managed separately (`showDistricts`, `showCTU`, `showStateBoundary`, `showCountyBoundaries`)

**Recommendations:**
- **PAGE-SPECIFIC:** Create `BoundaryLayersManager.tsx` component:
  - Single component managing all boundary layers
  - Unified visibility state
  - Shared layer management logic
- **GLOBAL:** Create `useBoundaryLayers` hook for layer state management

---

### 8. Event System Consolidation

**Current Issues:**
- Custom events for permission denied (lines 104-119)
- Custom events for time filter changes (lines 715-720)
- Custom events for boundary changes (lines 722-732)

**Recommendations:**
- **PAGE-SPECIFIC:** Create `useMapEvents` hook:
  - Centralized event handling
  - Type-safe event definitions
  - Event cleanup management

---

### 9. Form State Consolidation

**Current Issues:**
- Multiple forms with similar patterns (settings, contribute, join)
- Form state scattered across components

**Recommendations:**
- **GLOBAL:** Create `useFormState` utility hook (if not exists):
  - Generic form state management
  - Validation helpers
  - Submit handlers
- **PAGE-SPECIFIC:** Use for settings, contribute, join forms

---

### 10. Media Upload Consolidation

**Current Issues:**
- Media upload logic in `ContributeOverlay.tsx`
- Similar logic likely in other components

**Recommendations:**
- **GLOBAL:** Create `useMediaUpload` hook:
  - File selection
  - Preview generation
  - Upload to Supabase
  - Progress tracking
  - Error handling

---

## Performance Optimizations

### 1. Memoization Opportunities

**Current Issues:**
- Sidebar configs recalculated on every render (lines 574-713)
- Permission handlers recreated on every render
- Map click handler recreated on dependencies

**Recommendations:**
- **PAGE-SPECIFIC:** Memoize sidebar configs (already using `useMemo`, but check dependencies)
- **PAGE-SPECIFIC:** Memoize permission handlers with `useCallback`
- **PAGE-SPECIFIC:** Review all `useCallback`/`useMemo` dependencies

---

### 2. Lazy Loading

**Current Issues:**
- All components loaded upfront
- Large components (`MentionsLayer`, `MapSettingsSidebar`) always in bundle

**Recommendations:**
- **PAGE-SPECIFIC:** Lazy load sidebar components:
  - `MapSettingsSidebar` - only when settings opened
  - `JoinMapSidebar` - only when join clicked
  - `MapPosts` - only when posts opened
- **PAGE-SPECIFIC:** Lazy load `ContributeOverlay` - only when `#contribute` hash present
- **GLOBAL:** Code split large components

---

### 3. Data Fetching Optimization

**Current Issues:**
- Initial data fetch happens on mount
- No caching strategy visible

**Recommendations:**
- **GLOBAL:** Consider React Query/SWR for data fetching:
  - Automatic caching
  - Background refetching
  - Optimistic updates
- **PAGE-SPECIFIC:** Implement stale-while-revalidate pattern

---

### 4. Map Rendering Optimization

**Current Issues:**
- Map resize on sidebar toggle (debounced but still triggers)
- Multiple boundary layers re-rendering

**Recommendations:**
- **PAGE-SPECIFIC:** Use CSS transforms for sidebar instead of width changes (avoids map resize)
- **PAGE-SPECIFIC:** Memoize boundary layer visibility props
- **GLOBAL:** Review Mapbox layer update patterns

---

### 5. Event Listener Optimization

**Current Issues:**
- Multiple event listeners added/removed
- Some listeners may not be cleaned up properly

**Recommendations:**
- **PAGE-SPECIFIC:** Audit all `useEffect` cleanup functions
- **PAGE-SPECIFIC:** Use event delegation where possible
- **GLOBAL:** Create `useEventListener` hook for consistent cleanup

---

## Refactoring Priority

### High Priority (Performance & Maintainability)

1. **Split large components** (MentionsLayer, MapSettingsSidebar, ContributeOverlay, MapIDBox)
   - **Impact:** Reduces bundle size, improves maintainability
   - **Scope:** PAGE-SPECIFIC
   - **Effort:** High

2. **Consolidate permission handlers**
   - **Impact:** Reduces duplication, easier to maintain
   - **Scope:** PAGE-SPECIFIC
   - **Effort:** Medium

3. **Extract click handler logic**
   - **Impact:** Reduces page component complexity
   - **Scope:** PAGE-SPECIFIC
   - **Effort:** Medium

4. **Consolidate state management**
   - **Impact:** Reduces component complexity, improves performance
   - **Scope:** PAGE-SPECIFIC
   - **Effort:** High

### Medium Priority (Code Quality)

5. **Extract sidebar configs**
   - **Impact:** Cleaner page component
   - **Scope:** PAGE-SPECIFIC
   - **Effort:** Low

6. **Consolidate boundary layers**
   - **Impact:** Reduces duplication
   - **Scope:** PAGE-SPECIFIC
   - **Effort:** Medium

7. **Lazy load sidebar components**
   - **Impact:** Reduces initial bundle size
   - **Scope:** PAGE-SPECIFIC
   - **Effort:** Low

### Low Priority (Nice to Have)

8. **Event system consolidation**
   - **Impact:** Better type safety
   - **Scope:** PAGE-SPECIFIC
   - **Effort:** Low

9. **Form state utilities**
   - **Impact:** Reusability
   - **Scope:** GLOBAL (if used elsewhere)
   - **Effort:** Medium

10. **Media upload hook**
    - **Impact:** Reusability
    - **Scope:** GLOBAL (if used elsewhere)
    - **Effort:** Medium

---

## Summary Statistics

### Component Sizes
- `page.tsx`: 1059 lines, 47+ hooks
- `MapIDBox.tsx`: 1547+ lines
- `MentionsLayer.tsx`: 1498 lines
- `MapSettingsSidebar.tsx`: 2100+ lines
- `ContributeOverlay.tsx`: 1667+ lines
- `JoinMapSidebar.tsx`: 447 lines

### State Variables (page.tsx)
- Map data: 4 variables
- Click handling: 3 variables
- Permissions: 1 variable
- Filters: 5 variables
- Sidebars: 1 variable
- Membership: 3 variables
- **Total: ~20+ state variables**

### Hooks Usage (page.tsx)
- `useState`: ~20 calls
- `useEffect`: ~15 calls
- `useCallback`: ~5 calls
- `useMemo`: ~3 calls
- `useRef`: ~3 calls
- Custom hooks: 5

### API Endpoints Used
- `/api/maps/[id]/data` - Aggregate (primary)
- `/api/maps/[id]/membership-requests` - Check pending
- `/api/analytics/map-view` - Record view
- `/api/posts` - Fetch posts (via MapPosts)

---

## Notes

- **GLOBAL** updates affect multiple pages/components
- **PAGE-SPECIFIC** updates only affect the custom map page
- All refactoring should maintain existing functionality
- Performance improvements should be measured before/after
- Consider incremental refactoring (one area at a time)
