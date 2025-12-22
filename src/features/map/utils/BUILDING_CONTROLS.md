# Building Extrusion Controls

## Complete List of Controllable Properties

### Visual Appearance
- **`fill-extrusion-opacity`** - Overall transparency (0-1, default: 0.6)
- **`fill-extrusion-color`** - Building color (hex string or gradient array)
- **`fill-extrusion-cast-shadows`** - Enable/disable shadow casting (boolean, default: false)

### Height & Dimensions
- **`fill-extrusion-height`** - Building height (uses `height` property from Mapbox data)
- **`fill-extrusion-base`** - Base height offset (uses `min_height` property from Mapbox data)
- **`fill-extrusion-vertical-scale`** - Global height multiplier (default: 1)

### Geometry & Positioning
- **`fill-extrusion-translate`** - Offset in pixels `[x, y]` (default: `[0, 0]`)
- **`fill-extrusion-edge-radius`** - Edge rounding radius in meters (default: 0)
- **`fill-extrusion-base-alignment`** - Base alignment: `"terrain"` or `"flat"` (default: `"terrain"`)

### Lighting Effects
- **`fill-extrusion-flood-light-color`** - Flood light color (default: `"#ffffff"`)
- **`fill-extrusion-flood-light-intensity`** - Flood light intensity 0-1 (default: 0)
- **`fill-extrusion-flood-light-wall-radius`** - Flood light wall radius in meters (default: 0)
- **`fill-extrusion-emissive-strength`** - Emissive light intensity (default: 0)

### Advanced Rendering
- **`fill-extrusion-cutoff-fade-range`** - Fade range before cutoff 0-1 (default: 0)
- **`fill-extrusion-line-width`** - Wall rendering mode (non-zero enables, default: 0)

### Layer Behavior
- **`minzoom`** - Minimum zoom level to show buildings (default: 14)

## What We Control (Custom)
- Layer addition/removal
- All paint properties above
- Zoom thresholds
- Color gradients

## What Mapbox Provides (Native Data)
- Building geometry (footprints)
- Height data (`height` property)
- Base height data (`min_height` property)
- Source: `composite` → `building` source-layer

