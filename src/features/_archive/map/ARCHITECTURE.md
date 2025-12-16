# Map System Architecture

## Folder Structure

```
src/features/map/
├── controllers/          # Business logic controllers
├── hooks/               # React hooks (composition layer)
├── utils/               # Pure utility functions
├── state/               # State management
├── config.ts            # Configuration (existing)
├── types.ts             # Type definitions (existing)
└── index.ts             # Public exports
```

## Controllers (`controllers/`)

### `mapInitializationController.ts`
**Responsibility:** Mapbox GL JS initialization and lifecycle
- `initializeMap()` - Creates map instance with config
- `destroyMap()` - Cleanup and removal
- `resizeMap()` - Handle container resize
- `validateMapConfig()` - Token and config validation

### `mapEventsController.ts`
**Responsibility:** Map event registration and delegation
- `registerMapEvents()` - Setup all event listeners
- `unregisterMapEvents()` - Cleanup event listeners
- `handleMapClick()` - Click detection and delegation
- `handleMapMove()` - Movement tracking
- `handleMapZoom()` - Zoom change tracking
- `handleMapRotate()` - Rotation tracking
- `handleMapPitch()` - Pitch change tracking

### `mapInfoController.ts`
**Responsibility:** Map state tracking (zoom, center, bearing, pitch)
- `trackMapInfo()` - Continuous state updates
- `getMapInfo()` - Current state snapshot
- `subscribeToMapInfo()` - State change subscriptions

### `markerController.ts`
**Responsibility:** Marker CRUD operations
- `createMarker()` - Create marker with options
- `updateMarker()` - Update marker position/options
- `removeMarker()` - Remove single marker
- `clearAllMarkers()` - Remove all markers
- `getMarker()` - Retrieve marker by ID
- `validateCoordinates()` - Coordinate validation

### `popupController.ts`
**Responsibility:** Popup management and event handling
- `createPopup()` - Create popup with content
- `attachPopupToMarker()` - Link popup to marker
- `updatePopupContent()` - Update popup HTML
- `removePopup()` - Remove popup
- `setupPopupListeners()` - Event delegation for popup actions

### `drawController.ts`
**Responsibility:** Mapbox Draw integration for polygon drawing
- `initializeDraw()` - Setup Mapbox Draw control
- `setDrawMode()` - Change drawing mode
- `getDrawnFeatures()` - Retrieve drawn geometry
- `clearDraw()` - Remove all drawn features
- `updateDrawStyles()` - Custom styling

### `styleController.ts`
**Responsibility:** Map style switching and management
- `changeStyle()` - Switch map style
- `getAvailableStyles()` - List available styles
- `preserveMapState()` - Save/restore state during style change
- `handleStyleLoad()` - Post-style-change setup

## Hooks (`hooks/`)

### `useMapInstance.ts`
**Responsibility:** Map instance lifecycle
- Returns: `{ map, mapLoaded, error }`
- Handles initialization, cleanup, loading state

### `useMapEvents.ts`
**Responsibility:** Map event subscriptions
- Returns: `{ onMapClick, onMapMove, onMapZoom }`
- Delegates to mapEventsController

### `useMapInfo.ts`
**Responsibility:** Reactive map state tracking
- Returns: `{ mapInfo, subscribe }`
- Uses mapInfoController for state updates

### `useMarkers.ts`
**Responsibility:** Marker management hook
- Returns: `{ addMarker, removeMarker, clearMarkers, updateMarker, markers }`
- Uses markerController

### `usePopups.ts`
**Responsibility:** Popup management hook
- Returns: `{ createPopup, removePopup, updatePopup }`
- Uses popupController

### `useMapDraw.ts`
**Responsibility:** Drawing functionality hook
- Returns: `{ draw, drawMode, setDrawMode, clearDraw, getFeatures }`
- Uses drawController

### `useMapStyle.ts`
**Responsibility:** Style switching hook
- Returns: `{ currentStyle, changeStyle, availableStyles }`
- Uses styleController

### `useMapNavigation.ts`
**Responsibility:** Map navigation (flyTo, fitBounds, etc.)
- Returns: `{ flyTo, fitBounds, zoomTo, panTo }`
- Pure navigation operations

## Utils (`utils/`)

### `mapValidation.ts`
**Responsibility:** Map-related validation
- `validateCoordinates()` - Lat/lng validation
- `validateMapConfig()` - Config validation
- `isWithinBounds()` - Minnesota bounds check

### `mapCalculations.ts`
**Responsibility:** Map calculations
- `calculateBounds()` - Bounding box calculation
- `calculateCenter()` - Center point calculation
- `calculateZoom()` - Optimal zoom level

### `mapEventHelpers.ts`
**Responsibility:** Event handling utilities
- `isMarkerClick()` - Detect marker clicks
- `isPopupClick()` - Detect popup clicks
- `getClickTarget()` - Identify click target

### `mapboxLoader.ts`
**Responsibility:** Mapbox GL dynamic loading
- `loadMapboxGL()` - Dynamic import
- `loadMapboxDraw()` - Draw plugin loading
- `ensureMapboxLoaded()` - Loading state management

## State (`state/`)

### `mapState.ts`
**Responsibility:** Centralized map state
- `MapState` interface
- State getters/setters
- State subscriptions

### `markerState.ts`
**Responsibility:** Marker collection state
- `MarkerRegistry` - Map of markers
- Marker state management
- Marker queries

## Composition

### `useMap.ts` (Main Hook)
**Responsibility:** Composes all controllers and hooks
- Initializes map via mapInitializationController
- Composes useMapEvents, useMapInfo, useMarkers, usePopups
- Returns unified API matching current interface
- Maintains backward compatibility

## File Responsibilities Summary

| File | Responsibility | Functions/Hooks |
|------|---------------|-----------------|
| `controllers/mapInitializationController.ts` | Map lifecycle | initializeMap, destroyMap, resizeMap |
| `controllers/mapEventsController.ts` | Event handling | registerMapEvents, handleMapClick, handleMapMove |
| `controllers/mapInfoController.ts` | State tracking | trackMapInfo, getMapInfo, subscribeToMapInfo |
| `controllers/markerController.ts` | Marker operations | createMarker, updateMarker, removeMarker, clearAllMarkers |
| `controllers/popupController.ts` | Popup management | createPopup, attachPopupToMarker, updatePopupContent |
| `controllers/drawController.ts` | Drawing functionality | initializeDraw, setDrawMode, getDrawnFeatures |
| `controllers/styleController.ts` | Style switching | changeStyle, preserveMapState, handleStyleLoad |
| `hooks/useMapInstance.ts` | Map instance | map, mapLoaded, error |
| `hooks/useMapEvents.ts` | Event subscriptions | onMapClick, onMapMove, onMapZoom |
| `hooks/useMapInfo.ts` | Reactive state | mapInfo, subscribe |
| `hooks/useMarkers.ts` | Marker management | addMarker, removeMarker, clearMarkers |
| `hooks/usePopups.ts` | Popup management | createPopup, removePopup, updatePopup |
| `hooks/useMapDraw.ts` | Drawing | draw, drawMode, setDrawMode |
| `hooks/useMapStyle.ts` | Style switching | currentStyle, changeStyle |
| `hooks/useMapNavigation.ts` | Navigation | flyTo, fitBounds, zoomTo |
| `utils/mapValidation.ts` | Validation | validateCoordinates, isWithinBounds |
| `utils/mapCalculations.ts` | Calculations | calculateBounds, calculateCenter |
| `utils/mapEventHelpers.ts` | Event utilities | isMarkerClick, getClickTarget |
| `utils/mapboxLoader.ts` | Dynamic loading | loadMapboxGL, loadMapboxDraw |
| `state/mapState.ts` | Centralized state | MapState interface, subscriptions |
| `state/markerState.ts` | Marker registry | MarkerRegistry, queries |



