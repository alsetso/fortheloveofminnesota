# Live Map Page: Strategic Review of Primary UI Flows

## Overview

The `/live` page implements two primary user interaction flows:
1. **Mention Selection Flow**: Clicking a mention (with `mentionId` in URL)
2. **Add to Map Flow**: Clicking on the map to add a new mention

This document provides a high-level strategic review of the architecture, components, and interaction patterns.

---

## Architecture Overview

### Core Components Hierarchy

```
LivePage (src/app/live/page.tsx)
├── LivePageLayout
│   └── LiveMap (src/features/homepage/components/LiveMap.tsx)
│       ├── MentionsLayer (src/features/map/components/MentionsLayer.tsx)
│       ├── LocationSelectPopup (src/components/layout/LocationSelectPopup.tsx)
│       ├── CreateMentionPopup
│       │   └── CreateMentionContent
│       └── MentionLocationSheet (src/components/live/MentionLocationSheet.tsx)
└── MentionLocationSheet (conditional - when mentionId in URL)
```

### State Management Pattern

The page uses a **hybrid state management approach**:
- **URL State**: `lat`, `lng`, `zoom`, `mentionId` managed via `useLiveUrlState` hook
- **Component State**: Modal/popup visibility, selected mentions, map instance
- **Event-Driven Communication**: Custom events (`mention-click`, `mention-selected-from-map`, `show-location-for-mention`)

---

## Flow 1: Mention Selection (mentionId in URL)

### User Journey
1. User clicks mention in feed → navigates to `/live?lat=X&lng=Y&mentionId=Z`
2. Or user clicks mention on map → URL updated with `mentionId`
3. Page detects `mentionId` in URL
4. Map flies to location
5. `MentionLocationSheet` opens showing selected mention + nearby mentions

### Component Flow

```
URL Parameter (mentionId)
    ↓
useLiveUrlState hook detects mentionId
    ↓
LivePage useEffect (line 207-245)
    ├─ If mentionId but no lat/lng → fetch mention coordinates
    ├─ If lat/lng present → handleLocationNavigation()
    └─ Opens MentionLocationSheet
        ↓
MentionLocationSheet
    ├─ Fetches full mention details (if not already loaded)
    ├─ Displays selected mention details
    └─ Fetches nearby mentions (500m radius)
```

### Key Files

1. **`src/app/live/page.tsx`** (lines 206-267)
   - URL parameter watcher
   - Location navigation handler
   - Mention fetching and sheet management

2. **`src/features/homepage/hooks/useLiveUrlState.ts`**
   - URL state parsing and manipulation
   - Prevents duplicate processing with `hasProcessedUrl` flag

3. **`src/components/live/MentionLocationSheet.tsx`**
   - Unified sheet for mention details + nearby mentions
   - Handles both `mention` and `location` types
   - Fetches nearby mentions on open

4. **`src/features/map/components/MentionsLayer.tsx`** (lines 820-988)
   - Dispatches `mention-click` event when mention clicked
   - Handles mention highlighting via `selectedMentionId` prop

### Event Flow

```
MentionsLayer (click handler)
    ↓ dispatches 'mention-click'
LiveMap (listener, line 626-664)
    ↓ updates URL with mentionId
    ↓ dispatches 'mention-selected-from-map'
LivePage (listener, line 193-204)
    ↓ resets hasProcessedUrl flag
    ↓ triggers URL watcher
LivePage (URL watcher, line 207-245)
    ↓ fetches mention details
    ↓ opens MentionLocationSheet
```

### Strengths
- ✅ URL-based state enables shareable links
- ✅ Automatic coordinate fetching if only `mentionId` provided
- ✅ Unified sheet component reduces duplication
- ✅ Nearby mentions provide context

### Issues & Concerns

1. **Race Conditions**
   - Multiple `useEffect` hooks watching URL state can trigger simultaneously
   - `hasProcessedUrl` flag helps but may not prevent all edge cases
   - Coordinate fetching happens asynchronously, can cause re-renders

2. **State Synchronization**
   - URL state, component state, and event-driven updates can get out of sync
   - `selectedMention` state in LivePage vs `selectedMentionForSheet` in LiveMap

3. **Performance**
   - Mention fetching happens on every URL change
   - Nearby mentions fetched on every sheet open (no caching)
   - No debouncing on rapid URL changes

4. **Error Handling**
   - Limited error handling if mention fetch fails
   - No fallback if coordinates are invalid

---

## Flow 2: Add to Map (Map Click)

### User Journey
1. User clicks empty area on map
2. White pin marker appears at click location
3. `LocationSelectPopup` opens
4. User clicks "Add to Map" button
5. Navigates to `/add?lat=X&lng=Y`
6. Create mention form opens

### Component Flow

```
Map Click (LiveMap, line 935-1374)
    ↓
Checks if click hit mention layer → skip if yes
    ↓
Checks if click hit boundary layer → show LayerRecordPopup
    ↓
Otherwise:
    ├─ Drops white pin marker (temporaryMarkerRef)
    ├─ Reverse geocodes for address
    ├─ Captures map feature metadata
    └─ Opens LocationSelectPopup
        ↓
LocationSelectPopup
    ├─ Shows address, coordinates, map metadata
    └─ "Add to Map" button
        ↓
Navigates to /add?lat=X&lng=Y
    ↓
/add page opens CreateMentionContent
```

### Key Files

1. **`src/features/homepage/components/LiveMap.tsx`** (lines 935-1374)
   - Map click handler
   - Pin marker management
   - Reverse geocoding
   - Map feature extraction

2. **`src/components/layout/LocationSelectPopup.tsx`**
   - Bottom sheet popup
   - Address display and copy
   - Map metadata display
   - Navigation to `/add` page

3. **`src/app/add/page.tsx`**
   - Create mention page
   - Uses `CreateMentionContent` component

4. **`src/components/layout/CreateMentionContent.tsx`**
   - Form for creating mentions
   - Image upload
   - Collection assignment
   - Mention type selection

### Event Flow

```
Map Click Handler
    ↓
LocationSelectPopup opens
    ↓
User clicks "Add to Map"
    ↓
router.push('/add?lat=X&lng=Y')
    ↓
/add page loads with coordinates
    ↓
CreateMentionContent initialized
```

### Strengths
- ✅ Clear visual feedback (white pin marker)
- ✅ Rich context (address, map metadata)
- ✅ Smooth navigation flow
- ✅ Supports mention type pre-selection

### Issues & Concerns

1. **Navigation Pattern**
   - Navigates to separate `/add` page instead of inline form
   - Loses map context (user must navigate back)
   - Could use modal/sheet instead

2. **Pin Marker Management**
   - `temporaryMarkerRef` used for white pin
   - Complex state management for pin color changes (white → red)
   - Pin removal logic scattered across multiple effects

3. **Map Feature Extraction**
   - `queryFeatureAtPoint` called on every click
   - No caching of feature data
   - Can be slow on complex map styles

4. **Reverse Geocoding**
   - Happens synchronously on every click
   - No rate limiting or caching
   - Can cause delays in popup appearance

5. **State Cleanup**
   - Pin marker cleanup happens in multiple places
   - `isTransitioningToCreateRef` flag used to prevent cleanup during transitions
   - Complex conditional logic for marker removal

---

## Cross-Cutting Concerns

### 1. Event-Driven Architecture

**Pattern**: Heavy use of custom events for component communication
- `mention-click`
- `mention-selected-from-map`
- `show-location-for-mention`
- `mention-created`
- `mention-hover-start/end`

**Issues**:
- Hard to trace event flow
- No type safety for event payloads
- Event listeners can leak if not properly cleaned up
- Difficult to debug event timing issues

**Recommendation**: Consider using a state management library (Zustand, Jotai) or React Context for shared state instead of events.

### 2. URL State Management

**Pattern**: URL parameters as primary state source
- `lat`, `lng`, `zoom`, `mentionId` in URL
- `useLiveUrlState` hook manages parsing and updates

**Issues**:
- URL can get out of sync with component state
- Browser back/forward navigation can cause unexpected behavior
- Multiple components reading/writing URL state

**Recommendation**: Centralize URL state management in a single hook/provider.

### 3. Map Instance Management

**Pattern**: `mapInstanceRef` passed between components
- External ref in LivePage
- Internal ref in LiveMap
- Used for flyTo, getCenter, etc.

**Issues**:
- Ref can be null during initialization
- No type safety for Mapbox methods
- Multiple components accessing map instance

**Recommendation**: Create a MapContext provider to share map instance safely.

### 4. Modal/Popup Management

**Pattern**: Multiple modal states managed via `useLivePageModals` hook
- `create`, `account`, `camera`, `locationPermission`, etc.
- Conditional rendering based on modal state

**Issues**:
- Many modal states to track
- Modal stacking not well handled
- Close logic scattered across components

**Recommendation**: Use a modal manager/provider pattern (e.g., Radix UI Dialog with context).

### 5. Data Fetching

**Pattern**: Direct Supabase calls in components
- `MentionService.getMentions()`
- Direct Supabase queries in components
- No caching layer

**Issues**:
- No request deduplication
- No caching of fetched mentions
- Loading states managed locally
- Error handling inconsistent

**Recommendation**: Use React Query or SWR for data fetching with caching.

---

## Strategic Recommendations

### Short-Term (Quick Wins)

1. **Consolidate Mention Fetching**
   - Create a single hook for mention fetching
   - Add request deduplication
   - Cache nearby mentions

2. **Simplify Pin Marker Logic**
   - Extract pin marker management to a custom hook
   - Reduce conditional logic for color changes
   - Centralize cleanup logic

3. **Improve Error Handling**
   - Add error boundaries
   - Show user-friendly error messages
   - Handle network failures gracefully

### Medium-Term (Architecture Improvements)

1. **Replace Events with State Management**
   - Migrate from custom events to React Context or Zustand
   - Type-safe state updates
   - Easier debugging and testing

2. **Unify Modal Management**
   - Create a modal provider/manager
   - Handle modal stacking
   - Centralize open/close logic

3. **Optimize Data Fetching**
   - Implement React Query or SWR
   - Add request caching
   - Implement optimistic updates

### Long-Term (Major Refactoring)

1. **Consolidate Add Flow**
   - Keep create form inline (modal/sheet) instead of navigating to `/add`
   - Maintain map context during creation
   - Better UX for quick mentions

2. **Refactor URL State Management**
   - Single source of truth for URL state
   - Better handling of browser navigation
   - Type-safe URL parameters

3. **Component Architecture**
   - Extract map interaction logic to hooks
   - Separate presentation from business logic
   - Improve testability

---

## File Dependencies Map

### Core Files (High Priority Review)

1. **`src/app/live/page.tsx`**
   - Main page component
   - URL state management
   - Sheet coordination

2. **`src/features/homepage/components/LiveMap.tsx`**
   - Map initialization
   - Click handlers
   - Modal/popup management
   - Event listeners

3. **`src/features/map/components/MentionsLayer.tsx`**
   - Mention rendering
   - Click event dispatch
   - Highlight management

4. **`src/components/live/MentionLocationSheet.tsx`**
   - Unified mention/location sheet
   - Nearby mentions fetching

5. **`src/components/layout/LocationSelectPopup.tsx`**
   - Map click popup
   - Navigation to `/add`

### Supporting Files

- `src/features/homepage/hooks/useLiveUrlState.ts` - URL state hook
- `src/components/layout/CreateMentionContent.tsx` - Create form
- `src/app/add/page.tsx` - Add page (consider consolidating)

---

## Testing Considerations

### Current State
- No visible test files for these components
- Event-driven architecture makes testing difficult
- Map instance mocking required

### Recommended Tests

1. **Unit Tests**
   - URL state parsing
   - Event handlers
   - Data transformation

2. **Integration Tests**
   - Mention selection flow
   - Map click → popup → navigation
   - URL parameter changes

3. **E2E Tests**
   - Full user journeys
   - Browser navigation
   - Error scenarios

---

## Performance Considerations

### Current Issues

1. **No Request Deduplication**
   - Multiple components can fetch same mention
   - Nearby mentions fetched on every sheet open

2. **No Caching**
   - Mention data not cached
   - Map features not cached
   - Reverse geocoding not cached

3. **Heavy Re-renders**
   - URL changes trigger multiple effects
   - Map instance changes cause layer re-renders

### Optimization Opportunities

1. **Implement Caching**
   - Cache mention fetches (React Query)
   - Cache reverse geocoding results
   - Cache map feature extractions

2. **Debounce/Throttle**
   - Debounce URL updates
   - Throttle map click handlers
   - Debounce mention fetching

3. **Lazy Loading**
   - Lazy load CreateMentionContent
   - Lazy load MentionLocationSheet
   - Code split map components

---

## Conclusion

The live map page implements two distinct but related flows with a complex event-driven architecture. While functional, there are opportunities for:

1. **Simplification**: Reduce event-driven communication, consolidate state management
2. **Performance**: Add caching, request deduplication, optimize re-renders
3. **UX**: Keep create flow inline, improve error handling
4. **Maintainability**: Extract logic to hooks, improve type safety, add tests

The architecture is functional but would benefit from strategic refactoring to improve maintainability, performance, and developer experience.
