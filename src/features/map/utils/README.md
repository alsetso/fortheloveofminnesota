# Mapbox 3D Layers Utilities

## Building Extrusions

### What's Custom vs Mapbox-Defined

**Custom (Our Code):**
- Layer addition logic (when/how to add the layer)
- Visual styling configuration (opacity, colors, zoom levels)
- Layer positioning in the style stack

**Mapbox-Defined:**
- `fill-extrusion` layer type (Mapbox rendering engine)
- Building geometry data (height, min_height properties)
- `composite` source with `building` source-layer (built into Mapbox styles)
- Paint properties API (`fill-extrusion-color`, `fill-extrusion-opacity`, etc.)

### Usage

```typescript
import { addBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';

// Basic usage (default: opacity 0.6, height-based grayscale gradient)
addBuildingExtrusions(map);

// Custom configuration
addBuildingExtrusions(map, {
  opacity: 0.9,              // 0-1, default: 0.6
  color: '#888',             // Single color or gradient array
  minzoom: 13,               // When buildings appear, default: 14
  useHeightGradient: false,  // Disable height-based color, default: true
});
```

### Available Controls

- **Opacity**: `0` (transparent) to `1` (opaque) - controls building transparency
- **Color**: Single hex color or height-based gradient array
- **Minzoom**: Zoom level when buildings first appear (lower = earlier)
- **Height Gradient**: Automatically colors buildings darker as they get taller

## Vegetation/Trees

### Important Notes

**Trees are NOT added by our code** - they're part of the base Mapbox style layers.

**What Mapbox Provides:**
- Vegetation data in `landcover` and `landuse` source-layers
- 2D vegetation rendering (parks, forests, etc.)
- No 3D tree extrusions by default

**What We Can Control:**
- Visibility of existing vegetation layers
- Opacity adjustments
- Custom 3D tree extrusions (requires your own tree data with height properties)

### Usage

```typescript
import { enhanceVegetationLayers, addTreeExtrusions } from '@/features/map/utils/addVegetationLayers';

// Enhance existing vegetation layers (adjusts opacity, visibility)
enhanceVegetationLayers(map, {
  minzoom: 12,
  opacity: 1,
});

// Add custom 3D tree extrusions (requires tree GeoJSON data)
addTreeExtrusions(map, treeGeoJSONData, {
  opacity: 0.7,
  color: '#22c55e',
  minzoom: 14,
});
```

### Why Trees Don't Show in 3D

Mapbox styles don't include 3D tree extrusion data. To get 3D trees, you need:
1. Custom tree GeoJSON data with `height` properties
2. Use `addTreeExtrusions()` with your data
3. Or use a third-party service that provides tree data

## Style-Specific Behavior

Different Mapbox styles have different building/vegetation data:
- **streets-v12**: Full building data, some vegetation
- **satellite-streets-v12**: Full building data, minimal vegetation
- **light-v11**: Full building data, minimal vegetation
- **dark-v11**: Full building data, minimal vegetation
- **outdoors-v12**: Full building data, enhanced vegetation

If buildings don't appear, the style might not include building data in the `composite` source.
