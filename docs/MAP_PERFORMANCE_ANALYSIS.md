# Map Page Performance Analysis

## Auth Check Analysis

**On Map Page Load:**
- **General page load:** ~3-5 auth checks (middleware + initial API calls)
- **Map ID page load:** ~8-12 auth checks
  - `/api/maps/[id]` - 1 check
  - `/api/maps/[id]/stats` - 1 check  
  - `/api/maps/[id]/members` - 1 check (useMapMembership)
  - `/api/maps/[id]/pins` - 1 check
  - `/api/maps/[id]/areas` - 1 check
  - `/api/maps/[id]/categories` - 1 check (if settings open)
  - `/api/maps/[id]/membership-requests` - 1 check (if settings open)
  - `/api/analytics/map-view` - 1 check
  - Plus middleware auth check per request

**Auth Check Latency:** 200-800ms per check (terminal shows 240-880ms)
**Total Auth Overhead:** ~1.6-9.6 seconds on map page load

**Problem:** Each API route independently calls `getUser()`, no request-level caching.

---

## Network Load Analysis

**Current Map Page Load Sequence:**
1. Fetch map data (`/api/maps/[id]`) - includes full map object
2. Fetch stats (`/api/maps/[id]/stats`) - separate call
3. Fetch ALL pins (`/api/maps/[id]/pins`) - no viewport filtering
4. Fetch ALL areas (`/api/maps/[id]/areas`) - no viewport filtering
5. Fetch members (if owner) - separate call
6. Fetch categories (if settings open) - separate call
7. Record view - separate POST

**Data Transfer:**
- Pins: Full GeoJSON FeatureCollection (all pins, regardless of viewport)
- Areas: Full GeoJSON FeatureCollection (all areas, regardless of viewport)
- No compression, no quantization, no spatial filtering

**Heavy Layers:**
- Boundary layers (congressional districts, CTU, counties) loaded separately
- Each layer is a full GeoJSON payload
- No tiling, no progressive loading

---

## Three Critical Performance Improvements (Non-Obvious)

### 1. **Request-Level Auth Check Caching**

**Problem:** Each API route calls `getUser()` independently, even within the same HTTP request lifecycle.

**Solution:** Cache auth result per request using request ID or session token hash.

```typescript
// In withSecurity middleware
const requestId = req.headers.get('x-request-id') || generateRequestId();
const cachedAuth = requestAuthCache.get(requestId);

if (cachedAuth && cachedAuth.expiresAt > Date.now()) {
  // Use cached auth
} else {
  // Fetch and cache
  const auth = await optionalAuth();
  requestAuthCache.set(requestId, { ...auth, expiresAt: Date.now() + 5000 });
}
```

**Impact:** Reduces 8-12 auth checks to 1-2 per page load. Saves 1.4-8.4 seconds.

---

### 2. **Viewport-Based Spatial Loading with PostGIS**

**Problem:** Loading ALL pins/areas regardless of viewport wastes bandwidth and memory.

**Solution:** Use PostGIS spatial queries to load only visible features + buffer zone.

```sql
-- Add spatial index
CREATE INDEX IF NOT EXISTS idx_map_pins_location ON map_pins USING GIST (ST_Point(lng, lat));
CREATE INDEX IF NOT EXISTS idx_map_areas_geometry ON map_areas USING GIST (geometry);

-- Query with viewport bounds
SELECT * FROM map_pins 
WHERE map_id = $1 
AND ST_Within(
  ST_Point(lng, lat),
  ST_MakeEnvelope($minLng, $minLat, $maxLng, $maxLat, 4326)
);
```

**Client-side:**
```typescript
// Load data based on current viewport
const bounds = map.getBounds();
const bbox = [
  bounds.getWest(), // minLng
  bounds.getSouth(), // minLat  
  bounds.getEast(), // maxLng
  bounds.getNorth() // maxLat
];

// Fetch with bbox parameter
fetch(`/api/maps/${mapId}/pins?bbox=${bbox.join(',')}`);

// Reload on moveend (debounced)
map.on('moveend', debounce(() => {
  fetchViewportData();
}, 300));
```

**Impact:** 
- Reduces initial payload by 70-90% (only visible features)
- Faster initial render
- Lower memory usage
- Better mobile performance

---

### 3. **GeoJSON Coordinate Quantization & Compression**

**Problem:** Full precision coordinates (6-7 decimal places) in GeoJSON are wasteful. A single area polygon can be 50-200KB.

**Solution:** Quantize coordinates to viewport-appropriate precision + compress responses.

```typescript
// Quantize coordinates based on zoom level
function quantizeCoordinates(coords: number[][], zoom: number): number[][] {
  // At zoom 10, ~1m precision (5 decimals) is sufficient
  // At zoom 15, ~10cm precision (6 decimals) needed
  const precision = Math.max(5, Math.min(7, Math.floor(zoom / 2) + 5));
  const factor = Math.pow(10, precision);
  
  return coords.map(([lng, lat]) => [
    Math.round(lng * factor) / factor,
    Math.round(lat * factor) / factor
  ]);
}

// Compress response
response.headers.set('Content-Encoding', 'gzip');
response.headers.set('Content-Type', 'application/json');
```

**Alternative:** Use Mapbox Vector Tiles (MVT) instead of GeoJSON for areas.

**Impact:**
- Reduces GeoJSON payload by 40-60%
- Faster parsing
- Lower memory footprint
- Better for large datasets

---

## Additional Quick Wins

1. **Batch API Calls:** Combine pins + areas into single `/api/maps/[id]/entities?bbox=...` endpoint
2. **Client-Side Caching:** Cache pins/areas in IndexedDB with viewport keys
3. **Progressive Loading:** Load visible pins first, then areas, then off-screen data
4. **Debounce Map Moves:** Only reload data after user stops panning/zooming for 500ms
5. **Remove Redundant Fetches:** Don't fetch categories/members until sidebar actually opens

---

## Implementation Priority

1. **High:** Viewport-based loading (biggest impact)
2. **High:** Auth check caching (easy win, big time savings)
3. **Medium:** Coordinate quantization (good for large maps)
4. **Low:** Vector tiles migration (requires more refactoring)
