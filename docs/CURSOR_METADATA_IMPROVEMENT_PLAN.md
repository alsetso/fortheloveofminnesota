# Cursor & Metadata System Improvement Plan

## Current State Analysis

### What We Have
- `hoverFeature` state + ref updated on mouse move
- `pinFeature` captured from hover on click
- `locationData` from reverse geocoding (address, city, county)
- Cursor tracker UI at sidebar bottom
- Metadata accordion in location details

### Current Issues
1. **Redundant state** - `hoverFeature` state AND `hoverFeatureRef` both storing same data
2. **Inefficient queries** - `queryRenderedFeatures()` called on EVERY mouse move
3. **Limited feature extraction** - Only extracting subset of useful properties
4. **No persistence** - Metadata not saved with pins
5. **Poor UX** - Metadata accordion hidden by default, easy to miss
6. **Inconsistent categorization** - Category mapping scattered in code

---

## Improvement Plan

### Phase 1: Performance & Efficiency

#### 1.1 Throttle Mouse Move Handler
```typescript
// Current: Fires on every pixel movement
const handleMouseMove = useCallback((e) => {
  const metadata = getFeatureMetadata(e.point);
  setHoverFeature(metadata);
}, []);

// Improved: Throttle to 60fps (16ms) or less frequent
const handleMouseMove = useMemo(() => 
  throttle((e: MapboxMouseEvent) => {
    const metadata = getFeatureMetadata(e.point);
    hoverFeatureRef.current = metadata;
    setHoverFeature(metadata);
  }, 50), // 50ms = 20 updates/second
[getFeatureMetadata]);
```

#### 1.2 Remove Redundant State
```typescript
// Current: Both state and ref
const [hoverFeature, setHoverFeature] = useState<FeatureMetadata | null>(null);
const hoverFeatureRef = useRef<FeatureMetadata | null>(null);

// Improved: Just ref for click capture, state for UI only
// OR: Use single source with useSyncExternalStore for perf
```

#### 1.3 Memoize Feature Extraction
```typescript
// Cache category lookups
const categoryCache = new Map<string, string>();

function getFeatureCategory(properties: Record<string, any>, type: string): string {
  const cacheKey = `${type}:${properties.class}:${properties.type}`;
  if (categoryCache.has(cacheKey)) {
    return categoryCache.get(cacheKey)!;
  }
  // ... compute category
  categoryCache.set(cacheKey, category);
  return category;
}
```

---

### Phase 2: Enhanced Feature Extraction

#### 2.1 Create Dedicated Feature Service
```typescript
// src/features/map-metadata/services/featureService.ts

export interface ExtractedFeature {
  // Core identification
  layerId: string;
  sourceLayer: string;
  
  // Display
  name: string | null;
  category: FeatureCategory;
  icon: string;  // Emoji or icon name
  
  // Raw data
  properties: Record<string, any>;
  
  // Computed
  displayLabel: string;  // "Como Park · Park"
  isClickable: boolean;  // Has enough data to be useful
}

export type FeatureCategory = 
  | 'highway' | 'road' | 'street' | 'path' | 'trail'
  | 'city' | 'neighborhood' 
  | 'park' | 'lake' | 'building'
  | 'school' | 'hospital' | 'restaurant' | 'hotel'
  | 'poi' | 'unknown';

export function extractFeature(
  mapboxFeature: any,
  layerId: string
): ExtractedFeature {
  // Centralized extraction logic
}
```

#### 2.2 Complete Category Mapping (from hoverentities.md)
```typescript
// src/features/map-metadata/constants/categories.ts

export const ROAD_CATEGORIES: Record<string, FeatureCategory> = {
  'motorway': 'highway',
  'motorway_link': 'highway', 
  'trunk': 'highway',
  'trunk_link': 'highway',
  'primary': 'road',
  'secondary': 'road',
  'tertiary': 'road',
  'residential': 'street',
  'living_street': 'street',
  'service': 'road',
  'pedestrian': 'path',
  'footway': 'path',
  'path': 'path',
  'cycleway': 'path',
  'track': 'trail',
  'steps': 'path',
};

export const PLACE_CATEGORIES: Record<string, FeatureCategory> = {
  'settlement': 'city',
  'settlement_subdivision': 'neighborhood',
};

export const POI_CATEGORIES: Record<string, FeatureCategory> = {
  'education': 'school',
  'medical': 'hospital',
  'park': 'park',
  'park_like': 'park',
  'food_and_drink': 'restaurant',
  'lodging': 'hotel',
};

export const CATEGORY_ICONS: Record<FeatureCategory, string> = {
  'highway': '🛣️',
  'road': '🛤️',
  'street': '🏘️',
  'path': '🚶',
  'trail': '🥾',
  'city': '🏙️',
  'neighborhood': '🏘️',
  'park': '🌳',
  'lake': '💧',
  'building': '🏢',
  'school': '🏫',
  'hospital': '🏥',
  'restaurant': '🍽️',
  'hotel': '🏨',
  'poi': '📍',
  'unknown': '📍',
};
```

---

### Phase 3: Database Schema for Pin Metadata

#### 3.1 Add Columns to Pins Table
```sql
-- Migration: Add feature metadata to pins

ALTER TABLE public.pins 
ADD COLUMN IF NOT EXISTS feature_layer_id TEXT,
ADD COLUMN IF NOT EXISTS feature_name TEXT,
ADD COLUMN IF NOT EXISTS feature_category TEXT,
ADD COLUMN IF NOT EXISTS feature_properties JSONB DEFAULT '{}';

-- Index for querying by category
CREATE INDEX IF NOT EXISTS idx_pins_feature_category 
ON public.pins(feature_category) 
WHERE feature_category IS NOT NULL;

-- Index for searching by feature name
CREATE INDEX IF NOT EXISTS idx_pins_feature_name 
ON public.pins(feature_name) 
WHERE feature_name IS NOT NULL;

COMMENT ON COLUMN public.pins.feature_layer_id IS 'Mapbox layer ID where pin was placed (e.g., poi-label, road-primary)';
COMMENT ON COLUMN public.pins.feature_name IS 'Name of feature at pin location (e.g., Como Park, I-94)';
COMMENT ON COLUMN public.pins.feature_category IS 'Normalized category (park, highway, school, etc.)';
COMMENT ON COLUMN public.pins.feature_properties IS 'Raw properties from Mapbox feature';
```

#### 3.2 Update Pin Types
```typescript
// src/types/map-pin.ts

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  description: string | null;
  media_url: string | null;
  visibility: 'public' | 'only_me';
  account_id: string;
  created_at: string;
  
  // NEW: Feature metadata
  feature_layer_id: string | null;
  feature_name: string | null;
  feature_category: FeatureCategory | null;
  feature_properties: Record<string, any>;
}
```

#### 3.3 Update Pin Creation
```typescript
// When creating a pin, include captured metadata
const createPin = async (data: {
  lat: number;
  lng: number;
  description: string;
  // ...
  featureMetadata?: ExtractedFeature;
}) => {
  const { data: pin, error } = await supabase
    .from('pins')
    .insert({
      lat: data.lat,
      lng: data.lng,
      description: data.description,
      // NEW: Include metadata
      feature_layer_id: data.featureMetadata?.layerId ?? null,
      feature_name: data.featureMetadata?.name ?? null,
      feature_category: data.featureMetadata?.category ?? null,
      feature_properties: data.featureMetadata?.properties ?? {},
    })
    .select()
    .single();
};
```

---

### Phase 4: UI/UX Improvements

#### 4.1 Enhanced Cursor Tracker
```
Current:
┌─────────────────────────────────────┐
│ 🖱️ ● Como Park                      │
└─────────────────────────────────────┘

Improved:
┌─────────────────────────────────────┐
│ 🌳 Como Park                        │  ← Category icon
│    Park · Click to pin              │  ← Category + hint
└─────────────────────────────────────┘
```

#### 4.2 Location Details - Always Visible Metadata
```
Current: Hidden accordion
┌─────────────────────────────────────┐
│ Como Park · Park                    │
│ [▼] Show metadata                   │  ← User has to click
└─────────────────────────────────────┘

Improved: Prominent feature card
┌─────────────────────────────────────┐
│ 🌳 Como Park                        │
│ ──────────────────────────────────  │
│ Category: Park                      │
│ Layer: poi-label                    │
│                                     │
│ [View Details] [Explore]            │  ← Actions
└─────────────────────────────────────┘
```

#### 4.3 Feature-Specific Actions
```typescript
// Different actions based on feature category
const getFeatureActions = (feature: ExtractedFeature) => {
  switch (feature.category) {
    case 'city':
      return [
        { label: 'Explore City', action: () => openCityWindow(feature.name) },
        { label: 'View All Pins', action: () => filterPinsByCity(feature.name) },
      ];
    case 'park':
      return [
        { label: 'Park Info', action: () => openParkInfo(feature.name) },
        { label: 'Nearby Pins', action: () => showNearbyPins() },
      ];
    case 'highway':
    case 'road':
      return [
        { label: 'Traffic', action: () => showTrafficLayer() },
      ];
    default:
      return [];
  }
};
```

#### 4.4 Visual Feedback on Hover
```css
/* Highlight features on hover */
.mapboxgl-canvas-container:hover {
  cursor: pointer;
}

/* Show feature boundary on hover (advanced) */
map.on('mousemove', 'poi-label', (e) => {
  // Highlight the hovered feature
  map.setFeatureState(
    { source: 'composite', sourceLayer: 'poi_label', id: e.features[0].id },
    { hover: true }
  );
});
```

---

### Phase 5: Integration Points

#### 5.1 Pass Metadata to CreatePinModal
```typescript
// LocationSidebar.tsx
<CreatePinModal
  coordinates={createPinCoordinates}
  featureMetadata={pinFeature}  // Pass the captured metadata
  onPinCreated={handlePinCreated}
/>

// CreatePinModal.tsx
interface CreatePinModalProps {
  coordinates: { lat: number; lng: number };
  featureMetadata?: ExtractedFeature;  // Received metadata
}

// Show metadata preview in modal
{featureMetadata && (
  <div className="bg-gray-50 rounded p-2 mb-3">
    <span className="text-xs text-gray-500">Pinning at:</span>
    <div className="text-sm font-medium">
      {featureMetadata.icon} {featureMetadata.name || featureMetadata.category}
    </div>
  </div>
)}
```

#### 5.2 Display Stored Metadata on Pin Popups
```typescript
// PinsLayer.tsx - Pin popup content
const createPopupContent = (pin: MapPin) => {
  return `
    <div class="pin-popup">
      ${pin.feature_name ? `
        <div class="feature-badge">
          ${CATEGORY_ICONS[pin.feature_category]} ${pin.feature_name}
        </div>
      ` : ''}
      <div class="description">${pin.description}</div>
      <div class="meta">
        ${pin.feature_category ? `at ${pin.feature_category}` : ''}
      </div>
    </div>
  `;
};
```

#### 5.3 Search/Filter by Feature
```typescript
// Allow filtering pins by what they're placed on
const filterPinsByFeature = async (category: FeatureCategory) => {
  const { data: pins } = await supabase
    .from('pins')
    .select('*')
    .eq('feature_category', category);
  return pins;
};

// UI: Filter buttons
<div className="flex gap-2">
  <button onClick={() => filterPinsByFeature('park')}>🌳 Parks</button>
  <button onClick={() => filterPinsByFeature('school')}>🏫 Schools</button>
  <button onClick={() => filterPinsByFeature('highway')}>🛣️ Highways</button>
</div>
```

---

## Implementation Priority

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 1 | Throttle mouse move | Performance | Low |
| 2 | Create feature service | Code quality | Medium |
| 3 | Add DB columns | Persistence | Medium |
| 4 | Enhanced cursor tracker UI | UX | Low |
| 5 | Pass metadata to CreatePinModal | Feature | Low |
| 6 | Store metadata on pin creation | Feature | Medium |
| 7 | Display metadata on pin popups | UX | Medium |
| 8 | Feature-based filtering | Feature | High |

---

## File Structure

```
src/
├── features/
│   └── map-metadata/
│       ├── services/
│       │   └── featureService.ts      # Feature extraction logic
│       ├── constants/
│       │   └── categories.ts          # Category mappings
│       ├── hooks/
│       │   └── useFeatureTracking.ts  # Consolidated hover/click logic
│       ├── components/
│       │   ├── CursorTracker.tsx      # Bottom sidebar tracker
│       │   └── FeatureCard.tsx        # Location details feature display
│       └── index.ts
```

---

## Summary

**Key Changes:**
1. **Performance**: Throttle mouse tracking, cache computations
2. **Architecture**: Centralize feature extraction into dedicated service
3. **Persistence**: Store feature metadata with pins in database
4. **UI/UX**: Make metadata prominent, add category icons, feature-specific actions
5. **Integration**: Pass metadata through pin creation flow, display on popups

**Result**: Users can see what they're hovering over, that context is captured when they click, saved with their pin, and queryable later.



