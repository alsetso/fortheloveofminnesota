# Homepage URL Parameters

## Current State (Post-Cleanup)

**ONLY ONE URL PARAMETER IS SUPPORTED:**

### `year` (Filter Parameter)
- **Purpose**: Filter pins by creation year
- **Format**: `?year=2024`
- **Type**: Integer (year value)
- **Usage**: 
  - Read by: `HomepageStatsHandle`, `HomepageStatsModal`, `PinsListSidebar`, `FloatingMapContainer`
  - Updated by: Year filter input in `FloatingMapContainer`, `HomepageStatsModal`
  - Managed by: `useUrlMapState` hook

**Example URLs:**
- `/` - No filter (shows all pins)
- `/?year=2024` - Shows only pins from 2024
- `/?year=2023` - Shows only pins from 2023

## Removed Parameters

The following URL parameters have been **completely removed** from the homepage:

### Map State Parameters (REMOVED)
- ❌ `lat` - Latitude coordinate
- ❌ `lng` - Longitude coordinate  
- ❌ `zoom` - Map zoom level
- ❌ `pin` - Pin ID for selection

### Selection Parameters (REMOVED)
- ❌ `sel` - Selection type (location/pin/entity/none)
- ❌ `pinId` - Selected pin ID
- ❌ `entityType` - Selected entity type
- ❌ `entityId` - Selected entity ID

### Modal Parameters (REMOVED)
- ❌ `modal` - Modal type (welcome/onboarding/account/etc)
- ❌ `tab` - Account modal tab
- ❌ `modalPinId` - Analytics modal pin ID
- ❌ `modalMode` - Atlas modal mode
- ❌ `modalEntityType` - Atlas modal entity type
- ❌ `feature` - Upgrade/coming-soon modal feature

## Implementation Details

### Files That Handle `year` Parameter

1. **`src/components/feed/hooks/useUrlMapState.ts`**
   - Hook that manages year parameter in URL
   - Provides `urlState` and `updateUrl` function
   - Only handles `year` parameter

2. **`src/components/feed/HomepageStatsHandle.tsx`**
   - Reads `year` to display current filter
   - Shows year in UI and fetches pin count

3. **`src/components/feed/HomepageStatsModal.tsx`**
   - Reads `year` to show current selection
   - Updates `year` when user selects a year

4. **`src/components/feed/FloatingMapContainer.tsx`**
   - Year filter input reads/writes `year` parameter
   - Line 1933: Reads `searchParams.get('year')`
   - Lines 1938-1942: Updates URL with year

5. **`src/components/feed/PinsListSidebar.tsx`**
   - Reads `year` to filter pins when fetching
   - Lines 34, 66: `searchParams.get('year')`

6. **`src/components/feed/FeedMapClient.tsx`**
   - Calls `useUrlMapState()` to initialize year parameter handling

## Verification

To verify current state:
1. Check `useUrlMapState.ts` - should only handle `year`
2. Search codebase for `searchParams.get(` in feed components - should only find `year`
3. Search for URL parameter patterns - should only find `year`

## Migration Notes

- Map state (lat/lng/zoom/pin) is now **local state only**
- Selection state (sel/pinId/entityType) is now **local state only**
- Modal state is now **local state only** (managed by `useAppModals` hook)
- All URL-based deep linking for map/selection/modals has been removed
- Only year filter persists in URL for shareable filtered views

