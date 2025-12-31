# Map Meta Features

The `map.meta` JSONB column stores native Mapbox configuration settings that control map appearance and behavior.

## 3 Native Mapbox Features

### 1. **3D Buildings** (`buildingsEnabled: boolean`)
- **Default**: `false`
- **Description**: Toggles 3D building extrusions on/off
- **UX Impact**: Adds depth and context, especially useful for urban areas
- **Implementation**: Uses Mapbox's native `fill-extrusion` layer with building height data

### 2. **Map Pitch** (`pitch: number`)
- **Default**: `0`
- **Range**: `0-60` degrees
- **Description**: Tilts the map for 3D perspective view
- **UX Impact**: Creates immersive 3D experience, better for showing building heights
- **Implementation**: Mapbox `setPitch()` method

### 3. **Terrain** (`terrainEnabled: boolean`)
- **Default**: `false`
- **Description**: Enables 3D terrain elevation rendering
- **UX Impact**: Shows elevation changes, mountains, valleys - great for outdoor/topographic maps
- **Implementation**: Mapbox `addSource('mapbox-dem')` with terrain configuration

## Map Styles

The map supports 4 style options:
- **Street**: Standard street map with labels
- **Satellite**: Satellite imagery with street labels
- **Light**: Minimal light theme
- **Dark**: Dark theme for low-light viewing

## Usage

### Setting Meta on Map Creation

```typescript
// In /maps/new form
const meta = {
  buildingsEnabled: true,
  pitch: 45,
  bearing: 0,
  terrainEnabled: false,
  showNavigationControls: true
};

// Save with map
await fetch('/api/maps', {
  method: 'POST',
  body: JSON.stringify({
    title: 'My Map',
    map_style: 'street',
    meta: meta
  })
});
```

### Reading Meta on Map Display

```typescript
// In /map/[id] page
const mapData = await fetch(`/api/maps/${mapId}`);
const { meta } = mapData;

// Apply to map instance
if (meta?.buildingsEnabled) {
  addBuildingExtrusions(mapInstance);
}
if (meta?.pitch !== undefined) {
  mapInstance.setPitch(meta.pitch);
}
if (meta?.bearing !== undefined) {
  mapInstance.setBearing(meta.bearing);
}
// etc.
```

## Default Values

If `meta` is null or missing fields, use these defaults:

```json
{
  "buildingsEnabled": false,
  "pitch": 0,
  "terrainEnabled": false
}
```

