# Map Metadata Cursor Logic Implementation Guide

## Overview

This system captures Mapbox map features during cursor hover and click events, extracts structured metadata, and formats it for display. The `map_meta` object stores contextual information about the map feature at the location where a pin/mention was created.

## Architecture Flow

```
User hovers map → useFeatureTracking hook → queryFeatureAtPoint() → extractFeature() → CursorTracker (UI)
User clicks map → Capture hover feature → Store as mapMeta → Format for display → Save with pin/mention
```

## Core Components

### 1. Feature Extraction Service (`featureService.ts`)

**Primary Functions:**
- `queryFeatureAtPoint(map, point, priorityMode, returnRaw)` - Queries Mapbox for features at a point
- `extractFeature(mapboxFeature)` - Extracts and categorizes a feature
- `determineCategory(layerId, properties)` - Categorizes features (building, poi, road, etc.)

**Key Logic:**
```typescript
// Priority modes determine feature selection order
'labels-first': Labels → Geometry → POI points
'geometry-first': Building geometry → Polygons → Labels → POI points

// Always filters out custom layers
if (source === 'map-pins' || source.startsWith('atlas-')) return false;
```

### 2. Feature Tracking Hook (`useFeatureTracking.ts`)

**Purpose:** Tracks hover state and captures features on click

**Implementation Pattern:**
```typescript
// Throttled hover tracking (50ms default)
const handleMouseMove = throttle((e) => {
  const feature = queryFeatureAtPoint(map, e.point);
  hoverFeatureRef.current = feature; // Store in ref for click capture
  setHoverFeature(feature); // Update UI state
}, throttleMs);

// Click captures current hover
const handleClick = () => {
  setClickFeature(hoverFeatureRef.current); // Use ref to avoid stale closure
};
```

**Key Points:**
- Uses ref to store hover feature (avoids stale closures)
- Throttles mousemove events for performance
- Registers/unregisters map event listeners in useEffect

### 3. Map Click Handlers

**Two implementations:**
- `useMapClickHandler` - Legacy handler
- `useUnifiedMapClickHandler` - Current unified handler

**Click Capture Pattern:**
```typescript
// On map click, capture feature at click point
const point = map.project([lng, lat]);
const result = queryFeatureAtPoint(map, point, 'labels-first', false);

if (result && 'feature' in result) {
  mapMeta = {
    location: null,
    feature: {
      layerId: result.feature.layerId,
      sourceLayer: result.feature.sourceLayer,
      category: result.feature.category,
      name: result.feature.name,
      label: result.feature.label,
      icon: result.feature.icon,
      properties: result.feature.properties,
      showIntelligence: result.feature.showIntelligence,
    },
  };
}
```

## Map_Meta Structure

```typescript
interface MapMeta {
  location: null; // Reserved for future use
  feature: {
    layerId: string;           // Mapbox layer ID (e.g., "poi-label", "building")
    sourceLayer: string | null; // Source layer name
    category: FeatureCategory;  // Categorized type (building, poi, road, etc.)
    name: string | null;        // Feature name (e.g., "Target", "Lake Calhoun")
    label: string;              // Display label (e.g., "Building", "Point of Interest")
    icon: string;              // Emoji icon (e.g., "🏢", "📍")
    properties: Record<string, any>; // Raw Mapbox properties
    showIntelligence: boolean;  // Whether to show intelligence features
  };
}
```

## Formatting Logic

### Display Name Priority (for UI display)

**Implementation Pattern:**
```typescript
let displayName = feature.name || 'Map Feature';

if (!feature.name) {
  // Fallback chain
  if (props.type) {
    displayName = String(props.type);
  } else if (props.class) {
    displayName = String(props.class).replace(/_/g, ' ');
  } else if (feature.layerId) {
    // Parse layerId patterns
    const layerId = feature.layerId.toLowerCase();
    if (layerId.includes('poi')) displayName = 'Point of Interest';
    else if (layerId.includes('building')) displayName = 'Building';
    else if (layerId.includes('road') || layerId.includes('highway')) displayName = 'Road';
    else if (layerId.includes('water')) displayName = 'Water';
    else if (layerId.includes('landuse')) displayName = 'Land Use';
    else if (layerId.includes('place')) displayName = 'Place';
    else displayName = feature.layerId.replace(/-/g, ' ').replace(/_/g, ' ');
  }
}
```

### Category Label Priority

```typescript
let categoryLabel = feature.category && feature.category !== 'unknown' 
  ? feature.category.replace(/_/g, ' ')
  : null;

if (!categoryLabel || categoryLabel === 'unknown') {
  // Fallback chain
  if (props.type) categoryLabel = String(props.type).replace(/_/g, ' ');
  else if (props.class) categoryLabel = String(props.class).replace(/_/g, ' ');
  else if (feature.sourceLayer) categoryLabel = feature.sourceLayer.replace(/_/g, ' ');
  else if (feature.layerId) {
    // Parse layerId (same patterns as displayName)
  }
}
```

### Single-Line Format

```typescript
const singleLineLabel = categoryLabel && categoryLabel !== displayName
  ? `${displayName} • ${categoryLabel}`
  : displayName;
```

## UI Components

### 1. CursorTracker (Hover Display)

**Location:** Bottom of sidebar, shows live hover feedback

**Format:**
- Feature: `"Name · Category"` or `"Name"` if they match
- Mention: `"Mention {id} · {accountName}"`
- Empty: `"Hover map"`

**Styling:** Ultra-compact (`px-2 py-1`, `text-xs`, `border-gray-200`)

### 2. MapEntityPopup (Pin Details)

**Location:** Shows when pin/mention is clicked

**Display Logic:**
```typescript
{data.map_meta && data.map_meta.feature && (() => {
  const feature = data.map_meta.feature;
  const props = feature.properties || {};
  
  // Apply display name and category label formatting
  // Show as compact button with icon + info button
  // Info button shows tooltip on hover/click
})()}
```

**Styling:** Compact button (`px-1.5 py-0.5`, `text-[9px]`, `max-w-[100px]`)

### 3. ContributeOverlay (Create Pin)

**Location:** Overlay when creating new pin

**Display:** Same formatting logic as MapEntityPopup, shows map_meta context during creation

## Implementation Checklist

### Step 1: Set Up Feature Tracking

```typescript
import { useFeatureTracking } from '@/features/map-metadata/hooks/useFeatureTracking';

const { hoverFeature, clickFeature } = useFeatureTracking(
  map,
  mapLoaded,
  { throttleMs: 50, enabled: true }
);
```

### Step 2: Capture on Map Click

```typescript
const handleMapClick = async (e: any) => {
  const { lng, lat } = e.lngLat;
  const point = map.project([lng, lat]);
  
  // Capture map_meta
  let mapMeta: Record<string, any> | null = null;
  try {
    const result = queryFeatureAtPoint(map, point, 'labels-first', false);
    if (result && 'feature' in result) {
      mapMeta = {
        location: null,
        feature: {
          layerId: result.feature.layerId,
          sourceLayer: result.feature.sourceLayer,
          category: result.feature.category,
          name: result.feature.name,
          label: result.feature.label,
          icon: result.feature.icon,
          properties: result.feature.properties,
          showIntelligence: result.feature.showIntelligence,
        },
      };
    }
  } catch (err) {
    console.debug('Error capturing map feature:', err);
  }
  
  // Store mapMeta with location data
  setLocationSelectPopup({ lat, lng, address: null, mapMeta });
};
```

### Step 3: Format for Display

```typescript
function formatMapMetaDisplay(mapMeta: MapMeta | null): string {
  if (!mapMeta?.feature) return '';
  
  const feature = mapMeta.feature;
  const props = feature.properties || {};
  
  // Get display name (use priority chain)
  let displayName = feature.name || 'Map Feature';
  if (!feature.name) {
    if (props.type) displayName = String(props.type);
    else if (props.class) displayName = String(props.class).replace(/_/g, ' ');
    else if (feature.layerId) {
      const layerId = feature.layerId.toLowerCase();
      if (layerId.includes('poi')) displayName = 'Point of Interest';
      else if (layerId.includes('building')) displayName = 'Building';
      // ... other patterns
    }
  }
  
  // Get category label (use priority chain)
  let categoryLabel = feature.category && feature.category !== 'unknown'
    ? feature.category.replace(/_/g, ' ')
    : null;
  if (!categoryLabel) {
    if (props.type) categoryLabel = String(props.type).replace(/_/g, ' ');
    // ... other fallbacks
  }
  
  // Combine
  return categoryLabel && categoryLabel !== displayName
    ? `${displayName} • ${categoryLabel}`
    : displayName;
}
```

### Step 4: Save with Pin/Mention

```typescript
// When creating pin/mention, include mapMeta
const { data, error } = await supabase
  .from('map_pins')
  .insert({
    map_id: mapId,
    lat,
    lng,
    description,
    map_meta: mapMeta, // Store the full map_meta object
    // ... other fields
  });
```

## Common Patterns

### Pattern 1: Hover Feedback
- Use `useFeatureTracking` hook for live hover updates
- Display in `CursorTracker` component at bottom of sidebar
- Format: `"Name · Category"` or `"Name"` if they match

### Pattern 2: Click Capture
- Always capture `mapMeta` on map click, even if permission denied
- Use `queryFeatureAtPoint` with `'labels-first'` priority
- Store in location popup state, then save with pin/mention

### Pattern 3: Display Formatting
- Always use fallback chain: name → type → class → layerId parsing
- Replace underscores with spaces: `.replace(/_/g, ' ')`
- Combine name and category with ` • ` separator if different

### Pattern 4: Error Handling
- Wrap `queryFeatureAtPoint` in try/catch
- Log errors with `console.debug` (not console.error)
- Return `null` for mapMeta if extraction fails (don't block user flow)

## Key Files Reference

- **Feature Service:** `src/features/map-metadata/services/featureService.ts`
- **Tracking Hook:** `src/features/map-metadata/hooks/useFeatureTracking.ts`
- **Cursor Tracker:** `src/features/map-metadata/components/CursorTracker.tsx`
- **Click Handler:** `src/app/map/[id]/hooks/useUnifiedMapClickHandler.ts`
- **Display Components:** 
  - `src/components/layout/MapEntityPopup.tsx` (lines 495-594)
  - `src/app/map/[id]/components/ContributeOverlay.tsx` (lines 1070-1107)
  - `src/components/layout/CreateMentionContent.tsx` (lines 508-612)

## Testing Checklist

- [ ] Hover shows feature name in CursorTracker
- [ ] Click captures correct feature at click point
- [ ] mapMeta structure matches expected format
- [ ] Display formatting handles missing fields gracefully
- [ ] Fallback chain works for all priority levels
- [ ] Custom layers (pins, atlas) are filtered out
- [ ] Performance: hover throttling works (no lag)
- [ ] Error handling: failed extraction doesn't block user flow

## Notes

- **Performance:** Always throttle hover events (50ms default)
- **State Management:** Use refs for hover state to avoid stale closures
- **Filtering:** Always filter out custom layers (`map-pins`, `atlas-*`)
- **Formatting:** Apply formatting at display time, not storage time
- **Fallbacks:** Always provide fallback chain for missing data
- **Styling:** Follow government-style minimalism (compact, flat, no shadows)

## Data Formats & Pending Records Strategy

### Available Data Formats

**Raw map_meta structure:**
- `feature.layerId` - Mapbox layer ID (e.g., "poi-label", "building-fill")
- `feature.category` - Categorized type (building, poi, road, water, etc.)
- `feature.name` - Feature name if available (e.g., "Target", "Lake Calhoun")
- `feature.label` - Display category (e.g., "Building", "Point of Interest")
- `feature.icon` - Emoji icon (e.g., "🏢", "📍")
- `feature.properties` - Raw Mapbox properties (type, class, maki, etc.)
- `feature.showIntelligence` - Boolean flag for intelligence features

**Formatted display label:**
- Single-line: `"Name • Category"` or `"Name"` if they match
- Uses fallback chain when name missing (type → class → layerId parsing)

### Appending to Pending Records (Admin Hover Collection)

**Strategy:**
1. **Capture on hover, not click** - Use `hoverFeature` from `useFeatureTracking` hook
2. **Store full structure** - Save complete `mapMeta.feature` object, not just label (enables later analysis)
3. **Deduplicate by key** - Use `layerId + name + category` as unique key (same feature shouldn't appear twice)
4. **Throttle additions** - Leverage existing 50ms throttle, but add debounce for list updates (prevent rapid-fire duplicates)
5. **Include coordinates** - Store `{ lat, lng }` with each record (map_meta doesn't include location)

**Implementation pattern:**
```typescript
const pendingRecords = useRef<Map<string, PendingRecord>>(new Map());

const handleHoverFeature = useMemo(
  () => debounce((feature: ExtractedFeature | null, lat: number, lng: number) => {
    if (!feature) return;
    
    const key = `${feature.layerId}:${feature.name || ''}:${feature.category}`;
    if (pendingRecords.current.has(key)) return; // Deduplicate
    
    pendingRecords.current.set(key, {
      mapMeta: { location: null, feature },
      lat,
      lng,
      formattedLabel: formatMapMetaDisplay({ location: null, feature }),
      timestamp: Date.now(),
    });
  }, 200), // Debounce list updates
  []
);
```

**Key insight:** The formatted label is for display only. Store the raw `mapMeta.feature` structure to preserve all categorization data for later processing/analysis.
