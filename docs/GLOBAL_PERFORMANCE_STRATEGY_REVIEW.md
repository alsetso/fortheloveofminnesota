# Global Performance Strategy - Technical Review

## Executive Summary

The strategy document correctly identifies critical performance bottlenecks (auth overhead, sequential requests, spatial data bloat) and proposes sound solutions. However, several implementation details need correction for Next.js App Router compatibility and production readiness.

---

## Plan 1: Request-Level Auth Context - CRITICAL ISSUES

### Problem Identified ✅
- Correctly identifies 8-12 auth checks per map page (200-800ms each)
- Accurate assessment of total overhead (1.6-9.6s)

### Implementation Issues ❌

**1. AsyncLocalStorage Limitation**
```typescript
// PROPOSED (from doc):
import { AsyncLocalStorage } from 'async_hooks';
```
**Issue:** `async_hooks` is Node.js-specific and may not work in:
- Vercel Edge Runtime
- Serverless functions with cold starts
- Next.js middleware

**Better Approach:** Use Next.js `cache()` + request-scoped memoization:
```typescript
// src/lib/security/authContext.ts
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';

// Request-scoped cache key based on session token
const getAuthCacheKey = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sb-access-token')?.value || 
                       cookieStore.get('sb-refresh-token')?.value;
  return sessionToken ? `auth_${sessionToken.slice(0, 16)}` : null;
};

// Cache auth result per request using React cache()
export const getRequestAuth = cache(async () => {
  const cookieStore = await cookies();
  const supabase = await createServerClientWithAuth(cookieStore);
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { userId: null, accountId: null, cached: true };
  }
  
  // Get account ID (same logic as optionalAuth)
  const activeAccountId = cookieStore.get('active_account_id')?.value || null;
  let accountId: string | null = null;
  
  if (activeAccountId) {
    const { data } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', activeAccountId)
      .eq('user_id', user.id)
      .maybeSingle();
    accountId = data?.id || null;
  }
  
  if (!accountId) {
    const { data } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    accountId = data?.id || null;
  }
  
  return { userId: user.id, accountId, cached: true };
});
```

**2. API Route Integration**
The document's `withSecurity` update is correct in concept but needs refinement:

```typescript
// src/lib/security/middleware.ts
export async function withSecurity<T>(...) {
  // For API routes, we can't use React cache() directly
  // Use a WeakMap keyed by request object for request-scoped caching
  const existingAuth = getRequestAuthForApi(request);
  if (existingAuth?.cached) {
    return handler(request, {
      userId: existingAuth.userId,
      accountId: existingAuth.accountId,
    });
  }
  // ... rest of logic
}
```

**3. API Route-Specific Caching**
For API routes, use request-scoped WeakMap:

```typescript
// src/lib/security/authContext.ts
const apiAuthCache = new WeakMap<NextRequest, {
  userId?: string | null;
  accountId?: string | null;
  cached: boolean;
}>();

export async function getRequestAuthForApi(request: NextRequest) {
  const cached = apiAuthCache.get(request);
  if (cached) return cached;
  
  const auth = await optionalAuth();
  const result = {
    userId: auth.userId || undefined,
    accountId: auth.accountId || undefined,
    cached: true,
  };
  apiAuthCache.set(request, result);
  return result;
}
```

### Impact Assessment ✅
- Document's impact estimates are accurate
- 80% reduction is achievable with proper implementation
- **Priority: HIGHEST** - Correct assessment

---

## Plan 2: Unified Data Fetching Layer - PARTIAL ISSUES

### Problem Identified ✅
- Correctly identifies sequential API calls
- Accurate about missing batching

### Implementation Issues ⚠️

**1. Server Component Fetch Anti-Pattern**
```typescript
// FROM DOC (INEFFICIENT):
export default async function MapPage({ params }) {
  const aggregateData = await fetch(`/api/maps/${id}/aggregate`).then(r => r.json());
  return <MapPageClient initialData={aggregateData} />;
}
```

**Issue:** Server Components fetching from API routes adds unnecessary HTTP overhead.

**Correct Approach:** Direct database access in Server Component:
```typescript
// src/app/map/[id]/page.tsx
import { getRequestAuth } from '@/lib/security/authContext';
import { createServerClient } from '@/lib/supabaseServer';

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getRequestAuth();
  
  const supabase = auth?.userId 
    ? await createServerClientWithAuth(cookies())
    : createServerClient();
  
  // Parallel queries (single connection pool)
  const [mapResult, statsResult, pinsResult, areasResult, membersResult] = await Promise.all([
    getMap(supabase, id),
    getMapStats(supabase, id),
    getMapPins(supabase, id),
    getMapAreas(supabase, id),
    auth?.userId ? getMapMembers(supabase, id) : Promise.resolve(null),
  ]);
  
  return (
    <MapPageClient 
      initialData={{
        map: mapResult.data,
        stats: statsResult.data,
        pins: pinsResult.data,
        areas: areasResult.data,
        members: membersResult?.data || null,
      }}
    />
  );
}
```

**2. Aggregate Endpoint Still Needed**
The aggregate endpoint is still valuable for:
- Client-side updates (viewport changes)
- React Query cache population
- Non-SSR scenarios

**Correct Implementation:**
```typescript
// src/app/api/maps/[id]/aggregate/route.ts
export async function GET(request: NextRequest, { params }) {
  return withSecurity(request, async (req, { userId, accountId }) => {
    const { id } = await params;
    const auth = await getRequestAuthForApi(req); // Uses cached auth
    
    const supabase = auth?.userId
      ? await createServerClientWithAuth(req.cookies as any)
      : createServerClient();
    
    // Extract viewport from query params
    const url = new URL(req.url);
    const bbox = url.searchParams.get('bbox')?.split(',').map(Number);
    const zoom = Number(url.searchParams.get('zoom')) || 10;
    
    const [map, stats, pins, areas, members] = await Promise.all([
      getMap(supabase, id),
      getMapStats(supabase, id),
      bbox ? getMapPins(supabase, id, bbox) : getMapPins(supabase, id),
      bbox ? getMapAreas(supabase, id, bbox) : getMapAreas(supabase, id),
      auth?.userId ? getMapMembers(supabase, id) : Promise.resolve(null),
    ]);
    
    return NextResponse.json({
      map: map.data,
      stats: stats.data,
      entities: { pins: pins.data, areas: areas.data },
      members: members?.data || null,
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
      },
    });
  });
}
```

### Impact Assessment ✅
- Document's impact estimates are accurate
- 50% request reduction is achievable
- **Priority: HIGH** - Correct assessment

---

## Plan 3: Spatial Data Optimization - TECHNICAL GAPS

### Problem Identified ✅
- Correctly identifies viewport-agnostic loading
- Accurate about payload size issues

### Implementation Gaps ⚠️

**1. PostGIS Requirement**
Document assumes PostGIS is available. **Verify:**
```sql
-- Check PostGIS extension
SELECT PostGIS_version();

-- If not installed:
CREATE EXTENSION IF NOT EXISTS postgis;
```

**2. Spatial Index Missing**
Document doesn't mention spatial indexes:

```sql
-- Required indexes for performance
CREATE INDEX IF NOT EXISTS map_pins_location_idx 
ON map_pins USING GIST (ST_Point(lng, lat));

CREATE INDEX IF NOT EXISTS map_areas_geometry_idx 
ON map_areas USING GIST (geometry);
```

**3. Coordinate Quantization Implementation**
Document's quantization function needs refinement:

```typescript
// IMPROVED VERSION:
function quantizeCoords(
  coords: number[][], 
  zoom: number,
  precision?: number
): number[][] {
  // Zoom-based precision: higher zoom = more precision
  // Zoom 0-5: 4 decimals (11m precision)
  // Zoom 6-10: 5 decimals (1.1m precision)
  // Zoom 11-15: 6 decimals (0.11m precision)
  // Zoom 16+: 7 decimals (0.011m precision)
  const decimalPlaces = precision ?? Math.min(7, Math.max(4, Math.floor(zoom / 3) + 4));
  const factor = Math.pow(10, decimalPlaces);
  
  return coords.map(([lng, lat]) => [
    Math.round(lng * factor) / factor,
    Math.round(lat * factor) / factor,
  ]);
}
```

**4. Compression Configuration**
Document mentions gzip but doesn't specify Next.js configuration:

```typescript
// next.config.js
module.exports = {
  compress: true, // Enable gzip compression
  // ...
};
```

**5. Viewport Tracking Implementation**
Document's viewport tracking is good but needs debounce tuning:

```typescript
// OPTIMIZED VERSION:
const updateViewport = useMemo(
  () => debounce((bounds: mapboxgl.LngLatBounds, zoom: number) => {
    setViewport({
      bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      zoom,
    });
  }, 500), // Increased from 300ms for better batching
  []
);
```

### Impact Assessment ✅
- Document's 70% payload reduction is realistic
- **Priority: MEDIUM-HIGH** - Correct assessment

---

## Additional Critical Issues

### 1. React Query Integration Missing Details

Document mentions React Query but doesn't specify:
- **Cache configuration**
- **Stale time settings**
- **Query key structure**

**Recommended Implementation:**
```typescript
// src/lib/react-query/config.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      cacheTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

// Query keys
export const mapKeys = {
  all: ['maps'] as const,
  detail: (id: string) => [...mapKeys.all, id] as const,
  aggregate: (id: string, viewport?: Viewport) => 
    [...mapKeys.detail(id), 'aggregate', viewport] as const,
};
```

### 2. HTTP Cache Headers Inconsistency

Document mentions cache headers but doesn't specify strategy:

**Recommended Cache Strategy:**
```typescript
// Public map data: 5min cache, 10min stale
'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'

// Private map data: 1min cache, 5min stale
'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300'

// User-specific data: no cache
'Cache-Control': 'no-store, no-cache'
```

### 3. Database Connection Pooling

Document mentions pooling but doesn't verify Supabase configuration:

**Verify:**
- Transaction pooling enabled in Supabase dashboard
- Connection pooler URL used (not direct connection)
- Pool size appropriate for traffic

### 4. Missing: Request Deduplication Strategy

Document mentions deduplication but doesn't specify implementation:

**Recommended:**
```typescript
// src/lib/api/deduplication.ts
const pendingRequests = new Map<string, Promise<any>>();

export async function deduplicateRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) return existing;
  
  const promise = fn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}
```

---

## Implementation Priority - REVISED

### Phase 1: Quick Wins (1-2 days) ✅
1. ✅ **Request-level auth caching** - Use React `cache()` + WeakMap approach
2. ✅ **HTTP cache headers** - Implement with proper strategy
3. ✅ **Remove duplicate member fetches** - Already done

### Phase 2: Architecture (3-5 days) ⚠️
4. ✅ **Aggregate endpoints** - Keep for client-side, but use direct DB in Server Components
5. ⚠️ **Server Components migration** - **CRITICAL:** Don't fetch from API routes in Server Components
6. ✅ **React Query integration** - Add proper configuration

### Phase 3: Optimization (1 week) ⚠️
7. ⚠️ **Viewport-based loading** - **VERIFY PostGIS first**
8. ✅ **Coordinate quantization** - Use improved algorithm
9. ✅ **Response compression** - Configure Next.js compress

---

## Metrics to Track - ADDITIONS

Add these metrics to the document:

1. **Auth Cache Hit Rate** - Target: >90%
2. **Request Deduplication Rate** - Target: >50%
3. **Spatial Query Performance** - Target: <100ms for viewport queries
4. **Cache Hit Rate (HTTP)** - Target: >60% for public data
5. **Database Connection Pool Utilization** - Target: <80%

---

## Risk Assessment

### High Risk
- **AsyncLocalStorage approach** - Won't work in serverless/edge
- **Server Component API fetching** - Adds unnecessary overhead

### Medium Risk
- **PostGIS availability** - May require database migration
- **React Query migration** - Requires careful cache invalidation strategy

### Low Risk
- **HTTP cache headers** - Straightforward implementation
- **Coordinate quantization** - Pure client-side transformation

---

## Recommendations

1. **Immediate:** Fix Plan 1 implementation to use React `cache()` + WeakMap
2. **Immediate:** Update Plan 2 to use direct DB access in Server Components
3. **Before Phase 3:** Verify PostGIS extension and spatial indexes
4. **Add:** Request deduplication utility
5. **Add:** Comprehensive React Query configuration
6. **Add:** Monitoring for cache hit rates and auth overhead

---

## Conclusion

The strategy document is **fundamentally sound** but requires implementation corrections for Next.js App Router compatibility. The priority assessment is accurate, and the impact estimates are realistic. With the corrections above, the strategy is production-ready.
