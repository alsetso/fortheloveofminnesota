# Map Services Review

## Current Services Architecture

### API Routes

1. **`/api/maps/dynamic/[identifier]`** - Get map by ID or slug
   - Simple lookup
   - Returns full map object

2. **`/api/maps/dynamic/[identifier]/pins`** - Get pins for a map
   - Supports pagination
   - Filters by visibility
   - Extracts lat/lng from geometry

3. **`/api/maps/live`** - Get live map ID (legacy compatibility)
   - Returns `{ id, name, slug }`
   - Used by existing components

4. **`/api/maps/live/mentions`** - Get live map pins (legacy)
   - Returns 100 most recent public pins
   - Backward compatible with "mentions" terminology

5. **`/api/maps/live/pins/[pinId]`** - Get single pin
   - Fetches pin by ID
   - Includes account and tag data

### Components

1. **`DynamicMapContainer`** - New unified container
   - Takes identifier (ID or slug)
   - Uses `useDynamicMap` hook
   - Renders `MapIDBox` with proper props

2. **`MapIDBox`** - Core map rendering component
   - Handles Mapbox initialization
   - Manages pins, areas, boundaries
   - Supports live map mode

3. **`MentionsLayer`** - Pin rendering layer
   - Renders pins on map
   - Handles clustering
   - Manages caching

### Hooks

1. **`useDynamicMap`** - Map and pins data fetching
   - Auto-loads map and pins
   - Handles loading/error states
   - Returns `shouldRender` flag

2. **`useMapboxMap`** - Mapbox instance management
   - Creates/destroys map instance
   - Handles map events

## Migration Strategy

### Step 1: Replace Direct Map Queries

**Before:**
```typescript
fetch('/api/maps/live')
  .then(res => res.json())
  .then(data => setLiveMapId(data.id));
```

**After:**
```typescript
<DynamicMapContainer identifier="live" />
```

### Step 2: Use Dynamic Container

**Before:**
```typescript
<MapIDBox mapId={liveMapId} ... />
```

**After:**
```typescript
<DynamicMapContainer 
  identifier="live" // or UUID
  showPins={true}
  clusterPins={true}
/>
```

### Step 3: Simplify Page Components

**Before:**
- Multiple useEffect hooks fetching map data
- Manual state management
- Complex prop drilling

**After:**
- Single `<DynamicMapContainer>` component
- All logic encapsulated
- Clean, simple props

## Services Flow

```
User Request
  ↓
DynamicMapContainer (identifier: "live" | UUID)
  ↓
useDynamicMap Hook
  ↓
/api/maps/dynamic/[identifier] → Map Data
/api/maps/dynamic/[identifier]/pins → Pins Data
  ↓
MapIDBox Component
  ↓
Mapbox Map Instance
  ↓
MentionsLayer (renders pins)
```

## Benefits

1. **Single Source of Truth**: One component handles all map rendering
2. **Dynamic**: Works with any map ID or slug
3. **Simplified**: No complex prop drilling
4. **Reusable**: Same component for home, /maps, /map/[id]
5. **Type Safe**: Full TypeScript support
