# Dynamic Maps System

Simple, straightforward API system for fetching maps and pins by ID or slug.

## API Endpoints

### 1. Get Map by ID or Slug
```
GET /api/maps/dynamic/[identifier]
```

**Parameters:**
- `identifier`: Map UUID or slug

**Response:**
```json
{
  "map": {
    "id": "uuid",
    "name": "Map Name",
    "slug": "map-slug",
    "description": "...",
    "visibility": "public",
    "is_active": true,
    "created_at": "...",
    "updated_at": "..."
  },
  "found": true
}
```

**Example:**
```typescript
// By UUID
const response = await fetch('/api/maps/dynamic/2febd9ef-54cb-48b6-a98f-fe236453fc1c');

// By slug
const response = await fetch('/api/maps/dynamic/live');
```

---

### 2. Get Pins for a Map
```
GET /api/maps/dynamic/[identifier]/pins
```

**Query Parameters:**
- `limit`: Number of pins (default: 100)
- `offset`: Pagination offset (default: 0)
- `visibility`: Filter by visibility (default: 'public')

**Response:**
```json
{
  "pins": [
    {
      "id": "uuid",
      "map_id": "uuid",
      "lat": 44.9778,
      "lng": -93.2650,
      "body": "Pin description",
      "emoji": "📍",
      "image_url": "...",
      "account": {
        "image_url": "..."
      },
      "mention_type": {
        "id": "uuid",
        "emoji": "📍",
        "name": "Location"
      },
      "created_at": "..."
    }
  ],
  "count": 10,
  "map_id": "uuid"
}
```

**Example:**
```typescript
const response = await fetch('/api/maps/dynamic/live/pins?limit=50&visibility=public');
```

---

### 3. List All Maps
```
GET /api/maps/dynamic
```

**Query Parameters:**
- `limit`: Number of maps (default: 50)
- `offset`: Pagination offset (default: 0)
- `visibility`: Filter by visibility (default: 'public')

**Response:**
```json
{
  "maps": [
    {
      "id": "uuid",
      "name": "Map Name",
      "slug": "map-slug",
      "visibility": "public",
      "is_active": true
    }
  ],
  "count": 10
}
```

---

## Client-Side Usage

### Using the Hook

```typescript
import { useDynamicMap } from '@/hooks/useDynamicMap';

function MapComponent({ mapIdentifier }: { mapIdentifier: string }) {
  const { map, pins, loading, error, shouldRender, loadMap, loadPins } = useDynamicMap({
    identifier: mapIdentifier, // 'live' or UUID
    autoLoad: true,
    pinsLimit: 100,
    pinsVisibility: 'public'
  });
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!shouldRender) return <div>Map not available</div>;
  
  return (
    <div>
      <h1>{map?.name}</h1>
      <p>Pins: {pins.length}</p>
      {/* Render map and pins */}
    </div>
  );
}
```

### Manual API Calls

```typescript
// Load map
const mapResponse = await fetch(`/api/maps/dynamic/${identifier}`);
const { map } = await mapResponse.json();

// Load pins
const pinsResponse = await fetch(`/api/maps/dynamic/${identifier}/pins?limit=100`);
const { pins } = await pinsResponse.json();
```

---

## Utility Functions

### Parse Identifier

```typescript
import { parseMapIdentifier, isUUID } from '@/lib/maps/getMapByIdentifier';

const identifier = 'live';
const parsed = parseMapIdentifier(identifier);
// { id: null, slug: 'live' }

const uuid = '2febd9ef-54cb-48b6-a98f-fe236453fc1c';
const parsedUUID = parseMapIdentifier(uuid);
// { id: '2febd9ef-54cb-48b6-a98f-fe236453fc1c', slug: null }
```

### Check if Should Render

```typescript
import { shouldRenderMap } from '@/lib/maps/getMapByIdentifier';

const shouldRender = shouldRenderMap(map);
// Returns true if map exists and is_active = true
```

---

## Logic Flow

1. **Identifier Resolution:**
   - If UUID format → Query by `id`
   - Otherwise → Query by `slug`

2. **Map Visibility:**
   - `public` / `unlisted` → Visible to everyone
   - `private` → Requires authentication (simplified check)

3. **Pin Filtering:**
   - Only active pins (`is_active = true`)
   - Only non-archived pins (`archived = false`)
   - Filter by visibility (default: `public`)

4. **Rendering Decision:**
   - Map exists AND `is_active = true` → Render
   - Otherwise → Don't render

---

## Simple Example

```typescript
// Component that renders a map by slug or ID
'use client';

import { useDynamicMap } from '@/hooks/useDynamicMap';

export default function SimpleMapView({ identifier }: { identifier: string }) {
  const { map, pins, loading, shouldRender } = useDynamicMap({
    identifier,
    autoLoad: true
  });
  
  if (loading) return <div>Loading map...</div>;
  if (!shouldRender) return <div>Map not found</div>;
  
  return (
    <div>
      <h1>{map?.name}</h1>
      <p>{pins.length} pins</p>
      {/* Render your map component here */}
    </div>
  );
}
```

---

## Notes

- **Simple & Direct:** No complex logic, just basic CRUD operations
- **ID or Slug:** Works with either identifier type
- **Public by Default:** Returns public maps/pins unless specified
- **No Memberships:** Simplified access control (can add later)
- **Cross-Schema:** Handles `maps.pins` → `public.accounts` joins properly
