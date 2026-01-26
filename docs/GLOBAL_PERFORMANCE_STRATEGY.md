# Global Performance Strategy - Senior-Level Recommendations

## Current State Analysis

### Auth Check Overhead
- **8-12 auth checks per map page load** (200-800ms each = 1.6-9.6s total)
- **3-5 auth checks per general page load**
- Each API route independently calls `getUser()` via `withSecurity` → `optionalAuth()`
- No request-level deduplication
- Middleware also checks auth per request

### Network Request Patterns
- **Sequential fetches** instead of batching
- **Client-side data fetching** for server-available data
- **No request deduplication** (same endpoint called multiple times)
- **Missing HTTP caching** on many endpoints
- **No GraphQL/Batch API** for related data

### Data Fetching Architecture
- Heavy reliance on client-side `useEffect` + `fetch`
- Server components underutilized
- No React Query/SWR for request deduplication
- Inconsistent caching strategies

---

## Strategic Performance Plans

### Plan 1: Request-Level Auth Context (Critical - 80% reduction)

**Problem:** Every API route independently authenticates, even within same request lifecycle.

**Solution:** Implement request-scoped auth context using AsyncLocalStorage.

```typescript
// src/lib/security/authContext.ts
import { AsyncLocalStorage } from 'async_hooks';

const authContext = new AsyncLocalStorage<{
  userId?: string;
  accountId?: string;
  cached: boolean;
}>();

export function getRequestAuth() {
  return authContext.getStore();
}

export async function withAuthContext<T>(
  request: NextRequest,
  handler: () => Promise<T>
): Promise<T> {
  // Check if already authenticated in this request
  const existing = authContext.getStore();
  if (existing?.cached) {
    return handler();
  }

  // Authenticate once per request
  const auth = await optionalAuth();
  return authContext.run(
    { userId: auth.userId, accountId: auth.accountId, cached: true },
    handler
  );
}

// Update withSecurity to use context
export async function withSecurity<T>(...) {
  const existingAuth = getRequestAuth();
  if (existingAuth?.cached) {
    // Use cached auth, skip getUser() call
    return handler(request, {
      userId: existingAuth.userId,
      accountId: existingAuth.accountId,
    });
  }
  // ... existing logic
}
```

**Impact:**
- Reduces 8-12 auth checks to 1 per page load
- Saves 1.4-8.4 seconds on map pages
- Saves 0.6-4 seconds on general pages
- **ROI: Highest, easiest win**

---

### Plan 2: Unified Data Fetching Layer (Critical - 50% request reduction)

**Problem:** Multiple sequential API calls for related data, no batching, client-side fetching.

**Solution:** Create server-side data aggregation endpoints + move to Server Components.

```typescript
// src/app/api/maps/[id]/aggregate/route.ts
// Single endpoint that returns: map + stats + pins + areas + membership
export async function GET(request: NextRequest, { params }) {
  const { id } = await params;
  const auth = await getRequestAuth(); // Uses cached auth from Plan 1
  
  // Parallel database queries (single connection pool)
  const [map, stats, pins, areas, members] = await Promise.all([
    getMap(id),
    getMapStats(id),
    getMapPins(id, viewport), // Add viewport filtering
    getMapAreas(id, viewport),
    auth?.userId ? getMapMembers(id) : null,
  ]);

  return NextResponse.json({
    map,
    stats,
    entities: { pins, areas },
    members: members || null,
  }, {
    headers: {
      'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

// Convert map page to Server Component
// src/app/map/[id]/page.tsx (Server Component)
export default async function MapPage({ params }) {
  const { id } = await params;
  const aggregateData = await fetch(`/api/maps/${id}/aggregate`).then(r => r.json());
  
  return <MapPageClient initialData={aggregateData} />;
}
```

**Additional:** Implement React Query on client for request deduplication.

**Impact:**
- Reduces 7 API calls to 1 on map page load
- Eliminates duplicate requests (React Query deduplication)
- Faster initial render (server-side data)
- Better caching (single cache key)

---

### Plan 3: Spatial Data Optimization (High Impact - 70% payload reduction)

**Problem:** Loading all pins/areas regardless of viewport, full precision GeoJSON.

**Solution:** Viewport-based loading + coordinate quantization + compression.

```typescript
// 1. Add viewport parameter to pins/areas endpoints
GET /api/maps/[id]/entities?bbox=minLng,minLat,maxLng,maxLat&zoom=12

// 2. PostGIS spatial query
SELECT * FROM map_pins 
WHERE map_id = $1 
AND ST_Within(ST_Point(lng, lat), ST_MakeEnvelope($2, $3, $4, $5, 4326))
LIMIT 1000;

// 3. Quantize coordinates based on zoom
function quantizeCoords(coords: number[][], zoom: number): number[][] {
  const precision = Math.max(5, Math.min(7, Math.floor(zoom / 2) + 5));
  const factor = Math.pow(10, precision);
  return coords.map(([lng, lat]) => [
    Math.round(lng * factor) / factor,
    Math.round(lat * factor) / factor
  ]);
}

// 4. Compress response
response.headers.set('Content-Encoding', 'gzip');
```

**Client-side viewport tracking:**
```typescript
// Debounced viewport updates
const [viewport, setViewport] = useState(null);

useEffect(() => {
  if (!map) return;
  
  const updateViewport = debounce(() => {
    const bounds = map.getBounds();
    setViewport({
      bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      zoom: map.getZoom(),
    });
  }, 300);
  
  map.on('moveend', updateViewport);
  map.on('zoomend', updateViewport);
  updateViewport(); // Initial
  
  return () => {
    map.off('moveend', updateViewport);
    map.off('zoomend', updateViewport);
  };
}, [map]);
```

**Impact:**
- 70-90% payload reduction (only visible features)
- Faster parsing (fewer coordinates)
- Lower memory usage
- Better mobile performance

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. ✅ **Request-level auth caching** - Biggest time savings, low risk
2. ✅ **HTTP cache headers** - Add to all GET endpoints (5min cache)
3. ✅ **Remove duplicate member fetches** - Already done

### Phase 2: Architecture (3-5 days)
4. ✅ **Aggregate endpoints** - Combine related data fetches
5. ✅ **Server Components migration** - Move data fetching to server
6. ✅ **React Query integration** - Request deduplication + caching

### Phase 3: Optimization (1 week)
7. ✅ **Viewport-based loading** - PostGIS spatial queries
8. ✅ **Coordinate quantization** - Reduce GeoJSON size
9. ✅ **Response compression** - Gzip all JSON responses

---

## Expected Performance Gains

**Before:**
- Map page load: 8-12 API calls, 1.6-9.6s auth overhead, 2-5MB data transfer
- General page load: 3-5 API calls, 0.6-4s auth overhead

**After Phase 1:**
- Map page load: 8-12 API calls, **0.2-1s auth overhead** (80% reduction)
- General page load: 3-5 API calls, **0.1-0.8s auth overhead** (80% reduction)

**After Phase 2:**
- Map page load: **1-2 API calls**, 0.2-1s auth, **server-rendered initial data**
- General page load: **1-2 API calls**, 0.1-0.8s auth

**After Phase 3:**
- Map page load: 1-2 API calls, **0.6-1.5MB data** (70% reduction), viewport-optimized
- Faster initial render, better mobile performance

---

## Additional Strategic Recommendations

### 4. **Database Connection Pooling**
- Ensure Supabase connection pooler is configured
- Use transaction pooling for better concurrency
- **Impact:** Reduces connection overhead, improves concurrent request handling

### 5. **CDN/Edge Caching Strategy**
- Cache public map data at edge (Vercel Edge Network)
- Cache boundary layers (rarely change)
- **Impact:** Sub-100ms responses for cached content

### 6. **Code Splitting & Lazy Loading**
- Lazy load map components (Mapbox GL is heavy)
- Code split boundary layers
- **Impact:** Faster initial page load, smaller bundle

---

## Metrics to Track

1. **Time to First Byte (TTFB)** - Target: <200ms
2. **First Contentful Paint (FCP)** - Target: <1.5s
3. **Largest Contentful Paint (LCP)** - Target: <2.5s
4. **Total Blocking Time (TBT)** - Target: <300ms
5. **API Request Count** - Target: <5 per page load
6. **Total Data Transfer** - Target: <2MB per page load
