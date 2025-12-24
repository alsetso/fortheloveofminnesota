# Cursor Tracking & Mapbox Metadata System

## Overview

The cursor tracking system captures Mapbox feature metadata as the user moves their cursor over the map, then transfers that data to pins when the user clicks to create a location marker.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MAPBOX MAP                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Rendered Features (queryRenderedFeatures)                       │    │
│  │  • Roads: motorway, primary, residential, etc.                  │    │
│  │  • Places: cities, neighborhoods                                │    │
│  │  • POIs: schools, parks, hospitals, restaurants                 │    │
│  │  • Water: lakes, rivers, ponds                                  │    │
│  │  • Buildings: with height, type properties                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            [MOUSE MOVE]                       [CLICK]
                    │                               │
                    ▼                               ▼
┌─────────────────────────────┐    ┌─────────────────────────────┐
│      HOVER FEATURE          │    │      PIN FEATURE            │
│      (Real-time)            │    │      (On Click)             │
├─────────────────────────────┤    ├─────────────────────────────┤
│ State: hoverFeature         │───▶│ State: pinFeature           │
│ Ref: hoverFeatureRef        │    │                             │
├─────────────────────────────┤    ├─────────────────────────────┤
│ UI: Cursor Tracker          │    │ UI: Location Details        │
│ (Bottom of sidebar)         │    │ (Metadata Accordion)        │
└─────────────────────────────┘    └─────────────────────────────┘
```

## Data Flow

### 1. Mouse Move → Hover Feature

```typescript
const handleMouseMove = useCallback((e: MapboxMouseEvent) => {
  const metadata = getFeatureMetadata(e.point);
  setHoverFeature(metadata);           // Updates UI
  hoverFeatureRef.current = metadata;  // Stores for click
}, []);
```

**Output:** Cursor Tracker shows real-time feature under cursor

### 2. Click → Pin Feature (Captures Hover Data)

```typescript
const handleMapClick = useCallback(async (e: MapboxMouseEvent) => {
  // Capture whatever was being hovered
  const pinMetadata = hoverFeatureRef.current;
  setPinFeature(pinMetadata);
  
  // Also get reverse geocode data
  const geocodeResult = await reverseGeocode(lng, lat);
  // ... sets locationData with address, city, county, etc.
}, []);
```

**Output:** Location Details shows captured metadata

## Feature Metadata Structure

```typescript
interface FeatureMetadata {
  type: string;                    // Mapbox layer ID (e.g., "road-primary", "poi-label")
  name?: string;                   // Feature name (e.g., "Como Park", "I-94")
  properties: Record<string, any>; // Extracted properties
}
```

### Extracted Properties by Feature Type

| Feature Type | Properties Extracted |
|--------------|---------------------|
| **Roads** | `road_type`, `road_class`, `road_ref` |
| **Buildings** | `height`, `min_height`, `building_type` |
| **Water** | `water_type` |
| **Places** | `place_type` |
| **Land Use** | `landuse_type`, `landuse_class` |
| **POIs** | `class`, `type`, `name` |

## Mapbox Feature Categories

The `getFeatureCategory()` function maps raw Mapbox data to friendly labels:

```typescript
// Roads
'motorway' → 'Highway'
'primary', 'secondary', 'tertiary' → 'Road'
'residential', 'street' → 'Street'
'path', 'footway' → 'Path'

// Places
'settlement' → 'City'
'settlement_subdivision' → 'Neighborhood'

// POIs
'education' → 'School'
'park', 'park_like' → 'Park'
'water', 'lake' → 'Lake'
'medical' → 'Hospital'
```

## UI Components

### 1. Cursor Tracker (Always Visible)

```
┌─────────────────────────────────────┐
│ 🖱️ ● Como Park                      │  ← Shows hoverFeature
└─────────────────────────────────────┘
```

- Location: Bottom of left sidebar
- Updates: Real-time on mouse move
- Shows: Feature name or category, or "Tracking cursor..."

### 2. Location Details (On Click)

```
┌─────────────────────────────────────┐
│ Location Details              [X]   │
│                                     │
│ 123 Main St, Minneapolis...   [📋] │ ← Reverse geocode
│ Minneapolis  [Explore]             │ ← City + window button
│ Hennepin County, Minnesota, 55042  │
│ 44.977753  -93.265015              │
│                                     │
│ ─────────────────────────────────── │
│ Como Park · Park                    │ ← pinFeature.name + category
│ [▼] Show metadata                   │
│ ┌─────────────────────────────────┐ │
│ │ layer: poi-label                │ │
│ │ name: Como Park                 │ │
│ │ class: park_like                │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Data Sources Comparison

| Data | Source | When Updated | Contains |
|------|--------|--------------|----------|
| `hoverFeature` | `queryRenderedFeatures()` | Mouse move | Mapbox layer data at cursor |
| `pinFeature` | Captured from hover | Click | Mapbox layer data at click point |
| `locationData` | Mapbox Geocoding API | Click | Address, city, county, state, zip |

### Key Difference: Geocode vs Feature

- **Geocode (`locationData.city`)**: Returns "Minneapolis" from anywhere in Minneapolis
- **Feature (`pinFeature`)**: Returns specific feature at that pixel (park, road, building)

```
Same city, different features:

Click on I-94:     locationData.city = "Minneapolis"
                   pinFeature = { name: "I-94", type: "road-motorway" }

Click on stadium:  locationData.city = "Minneapolis"  
                   pinFeature = { name: "US Bank Stadium", type: "poi-label" }

Click on park:     locationData.city = "Minneapolis"
                   pinFeature = { name: "Minnehaha Falls", type: "poi-label", class: "park" }
```

## Future: Storing Metadata with Pins

When creating a pin, the captured metadata should be stored:

```typescript
// Current pin creation
const pin = {
  lat,
  lng,
  description,
  account_id,
  // ...
};

// Enhanced with metadata
const pin = {
  lat,
  lng,
  description,
  account_id,
  // NEW: Captured Mapbox metadata
  feature_type: pinFeature?.type,           // "poi-label"
  feature_name: pinFeature?.name,           // "Como Park"
  feature_category: getFeatureCategory(...), // "Park"
  feature_properties: pinFeature?.properties, // { class: "park_like", ... }
};
```

### Benefits of Storing Metadata

1. **Context**: Know what the pin was placed on (road vs park vs building)
2. **Search**: Find all pins on parks, or all pins on highways
3. **Display**: Show "Pinned at Como Park" vs just coordinates
4. **Analytics**: Understand where users are dropping pins

## Mapbox Layer Reference

See `/mapbox/hoverentities.md` for complete mapping of:
- Road classifications
- Place types
- POI classes and types
- Water feature types
- Land use categories



