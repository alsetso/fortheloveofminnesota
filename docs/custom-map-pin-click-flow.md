# Custom Map Pin Click Flow & Entity ID Parameter Breakdown

## Current Implementation

### User Experience Flow

1. **User clicks a pin on the custom map**
   - Location: `src/app/map/[id]/components/MapIDBox.tsx` (lines 770-834)
   - Mapbox click handler queries rendered features at click point
   - Extracts `pinId` from feature properties

2. **Pin data fetch**
   - API call: `GET /api/maps/${mapId}/pins/${pinId}`
   - Sets loading state: `setLoadingEntity(true)`
   - On success: sets `selectedEntity` and `selectedEntityType('pin')`

3. **Modal opens**
   - Component: `MapEntitySlideUp` (line 1402-1443)
   - Opens when: `selectedEntity !== null && selectedEntityType !== null`
   - Displays pin details, actions, and metadata

4. **URL parameter sync** (to be removed)
   - Location: `src/app/map/[id]/components/MapEntitySlideUp.tsx` (lines 324-344)
   - When modal opens: sets `?entity=pin&entityId={pinId}`
   - When modal closes: removes both parameters
   - Purpose: enables deep linking and browser back/forward navigation

5. **URL parameter restoration** (to be removed)
   - Location: `src/app/map/[id]/components/MapIDBox.tsx` (lines 640-674)
   - On mount/URL change: reads `entity` and `entityId` from searchParams
   - Fetches entity data and opens modal if parameters exist
   - Purpose: restores modal state from URL on page load

## Entity ID Parameter Details

### Current URL Structure
```
/map/{mapId}?entity=pin&entityId={pinId}
/map/{mapId}?entity=area&entityId={areaId}
/map/{mapId}?entity=layer&entityId={layerId}
```

### Parameter Usage
- **`entity`**: Type of entity (`pin`, `area`, or `layer`)
- **`entityId`**: UUID of the specific entity to display

### Where Parameters Are Set
1. **On pin click** (indirect): State change triggers URL update in `MapEntitySlideUp`
2. **On modal open**: `MapEntitySlideUp` useEffect (line 324) updates URL
3. **On modal close**: `MapEntitySlideUp` useEffect (line 338) removes parameters

### Where Parameters Are Read
1. **On page load**: `MapIDBox` useEffect (line 640) reads from `searchParams`
2. **On URL change**: Same useEffect triggers when `searchParams` changes

## Changes Required to Remove URL Parameters

### 1. Remove URL Writing (`MapEntitySlideUp.tsx`)
**Lines 324-344**: Remove the entire useEffect that updates URL parameters

```typescript
// REMOVE THIS:
useEffect(() => {
  if (isOpen && entity) {
    const params = new URLSearchParams(searchParams.toString());
    if (entityType === 'pin' && pin) {
      params.set('entity', 'pin');
      params.set('entityId', pin.id);
    } else if (entityType === 'area' && area) {
      params.set('entity', 'area');
      params.set('entityId', area.id);
    } else if (entityType === 'layer' && layer) {
      params.set('entity', 'layer');
      params.set('entityId', layer.layerId || '');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  } else if (!isOpen) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('entity');
    params.delete('entityId');
    router.replace(`?${params.toString()}`, { scroll: false });
  }
}, [isOpen, entity, entityType, pin, area, layer, router, searchParams]);
```

**Dependencies to remove**: `router`, `searchParams` from component props/imports if no longer used

### 2. Remove URL Reading (`MapIDBox.tsx`)
**Lines 640-674**: Remove the useEffect that reads URL parameters and loads entity

```typescript
// REMOVE THIS:
useEffect(() => {
  if (!mapLoaded || !mapId) return;

  const entityType = searchParams.get('entity');
  const entityId = searchParams.get('entityId');

  if (!entityType || !entityId) return;

  const loadEntity = async () => {
    setLoadingEntity(true);
    try {
      if (entityType === 'pin') {
        const response = await fetch(`/api/maps/${mapId}/pins/${entityId}`);
        if (response.ok) {
          const pinData = await response.json();
          setSelectedEntity(pinData);
          setSelectedEntityType('pin');
        }
      } else if (entityType === 'area') {
        const response = await fetch(`/api/maps/${mapId}/areas/${entityId}`);
        if (response.ok) {
          const areaData = await response.json();
          setSelectedEntity(areaData);
          setSelectedEntityType('area');
        }
      }
    } catch (err) {
      console.error('Error loading entity from URL:', err);
    } finally {
      setLoadingEntity(false);
    }
  };

  loadEntity();
}, [mapLoaded, mapId, searchParams, pins.length, areas.length]);
```

**Dependencies to remove**: `searchParams` from dependency array if no longer used elsewhere

### 3. Verify Modal Still Works
The modal opening logic (line 1402-1403) is **state-based**, not URL-based:
```typescript
<MapEntitySlideUp
  isOpen={selectedEntity !== null && selectedEntityType !== null}
  // ...
/>
```

This will continue to work after removing URL parameters because:
- Pin click sets `selectedEntity` and `selectedEntityType` (lines 795-796)
- Modal opens when both are non-null
- Modal closes when `onClose` clears both states (lines 1404-1407)

## Post-Removal Behavior

### What Still Works
- ✅ Clicking a pin opens the modal
- ✅ Modal displays pin details
- ✅ Closing modal works via `onClose` handler
- ✅ All modal functionality (edit, delete, etc.) remains intact

### What Changes
- ❌ No URL parameters set when modal opens
- ❌ No deep linking to specific pins via URL
- ❌ Browser back button won't close modal (will navigate away from page)
- ❌ Page refresh won't restore modal state

### Impact Assessment
- **Low impact**: Modal functionality is fully preserved
- **Lost feature**: Deep linking to specific pins (likely acceptable if not heavily used)
- **UX consideration**: Users can't bookmark/share links to specific pins

## Implementation Notes

### State Management
The modal is controlled by React state, not URL:
- `selectedEntity`: The entity data object (pin/area/layer)
- `selectedEntityType`: String type (`'pin'`, `'area'`, `'layer'`)

### Cleanup Required
After removing URL parameter logic:

1. **MapEntitySlideUp.tsx**:
   - Remove `useRouter` and `useSearchParams` from imports (line 4)
   - Remove `router` and `searchParams` declarations (lines 74-75)
   - These are only used for URL parameter management

2. **MapIDBox.tsx**:
   - Check if `useRouter` and `useSearchParams` are used elsewhere (line 4)
   - Remove `searchParams` from the dependency array of the removed useEffect
   - If `searchParams` is not used elsewhere, remove the import

3. **Testing**:
   - Verify modal opens when clicking a pin
   - Verify modal closes when clicking close button
   - Verify modal closes when clicking backdrop (if implemented)
   - Verify no console errors related to missing dependencies
   - Test area clicks (if applicable) to ensure they still work
