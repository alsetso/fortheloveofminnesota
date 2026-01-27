# Unified Map Click Handler - Senior Dev Approach

## Problem Statement

The current map click handling has several issues:
1. **Multiple competing handlers** - `useMapClickHandler`, `MapIDBox` pin/area handlers, and `MentionsLayer` all register separate click handlers
2. **No clear priority** - When layers overlap, behavior is unpredictable
3. **Duplicated logic** - Each handler tries to detect what was clicked
4. **Scattered permission checks** - Settings checks happen in multiple places
5. **Event conflicts** - Handlers can fire in wrong order or conflict

## Solution: Unified Click Handler with Priority System

### Architecture

**Single click handler registration** - One `map.on('click')` handler that processes all clicks

**Priority-based target detection** (highest to lowest):
1. **Pins** (custom map pins) - `map-pins-points`, `map-pins-point-label`
2. **Areas** (drawn areas) - `map-areas-fill`, `map-areas-outline`
3. **Mentions** (user-generated content) - `map-mentions-point`, `map-mentions-point-label`
4. **Map** (empty space) - Location selection or pin creation

### Key Improvements

1. **Centralized Permission Checks**
   - All permission checks happen in one place
   - Clear flow: check mode → check settings → check permissions → execute action

2. **Clean State Management**
   - Single source of truth for click state
   - No competing state updates
   - Predictable behavior

3. **Mode-Aware Handling**
   - Pin creation mode handled first (before location popup)
   - Area draw mode respected
   - Clear mode transitions

4. **Debouncing**
   - Prevents rapid click conflicts
   - Single debounce timer for all clicks

5. **Ref-Based Stability**
   - Handler function stored in ref to prevent re-registration
   - Frequently changing values stored in refs
   - Minimal effect dependencies

## Usage

```typescript
const { locationSelectPopup, closePopup, popupAddress } = useUnifiedMapClickHandler({
  map: mapInstanceRef.current,
  mapLoaded,
  mapData,
  account,
  isOwner,
  userRole,
  checkPermission,
  pinMode,
  showAreaDrawModal,
  onPinClick: (pinId) => {
    // Handle pin click - fetch and show sidebar
    window.dispatchEvent(new CustomEvent('entity-click', {
      detail: { entity: pinData, type: 'pin' }
    }));
  },
  onAreaClick: (areaId) => {
    // Handle area click - fetch and show sidebar
    window.dispatchEvent(new CustomEvent('entity-click', {
      detail: { entity: areaData, type: 'area' }
    }));
  },
  onMentionClick: (mentionId) => {
    // Handle mention click - fetch and show sidebar
    window.dispatchEvent(new CustomEvent('mention-click', {
      detail: { mention: mentionData }
    }));
  },
  onMapClick: (coordinates, mapMeta) => {
    // Handle map click for pin creation (when in pin mode)
    // This is only called when pinMode is true
  },
});
```

## Migration Steps

### 1. Update MapIDBox
- Remove separate pin/area click handlers (lines 777-843, ~1000)
- Remove map click handler for pin creation (lines 1077-1184)
- Use `useUnifiedMapClickHandler` instead
- Pass callbacks for `onPinClick`, `onAreaClick`, `onMapClick`

### 2. Update MentionsLayer
- Remove click handler registration (around line 1065-1251)
- Dispatch `mention-click` event instead
- Let unified handler detect mentions

### 3. Update Map Page
- Replace `useMapClickHandler` with `useUnifiedMapClickHandler`
- Pass all required callbacks
- Remove duplicate click handling logic

### 4. Update LiveMap (if needed)
- Similar approach - use unified handler
- Handle mentions via callback

## Benefits

1. **No more conflicts** - Single handler, clear priority
2. **Easier debugging** - All click logic in one place
3. **Better performance** - Single event listener, optimized detection
4. **Maintainable** - Clear separation of concerns
5. **Testable** - Single function to test click handling

## Implementation Notes

- Layer detection uses bounding box query (20px radius) for performance
- Handlers check if layers exist before querying (prevents errors)
- All async operations properly handled
- Cleanup on unmount prevents memory leaks
- Ref-based approach prevents unnecessary re-renders
