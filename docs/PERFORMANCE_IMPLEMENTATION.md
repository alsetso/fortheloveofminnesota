# Performance Implementation - Minimal Changes

## Current State
- **6 API calls** on map page load: map, stats, pins, areas, members, analytics
- **6-8 auth checks** (one per API call + middleware)
- **Sequential loading** (pins/areas load after map loads)

## Solution: 2 Changes

### 1. Request-Scoped Auth Cache (5 min)
Cache auth per API request using WeakMap.

### 2. Single Aggregate Endpoint (30 min)
One endpoint returns: map + stats + pins + areas + members.

**Result:**
- 6 API calls → 1 call
- 6-8 auth checks → 1 check
- Works for iOS app (same fetch API)
- No breaking changes

---

## Implementation

### Step 1: Add Auth Cache

```typescript
// src/lib/security/authContext.ts
import { NextRequest } from 'next/server';
import { optionalAuth } from './accessControl';

const apiAuthCache = new WeakMap<NextRequest, {
  userId?: string | null;
  accountId?: string | null;
  cached: boolean;
}>();

export async function getRequestAuth(request: NextRequest) {
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

### Step 2: Update withSecurity

```typescript
// src/lib/security/middleware.ts
import { getRequestAuth } from './authContext';

export async function withSecurity<T>(...) {
  // ... existing size check ...
  
  // Use cached auth
  const auth = await getRequestAuth(request);
  
  // ... rest of existing logic using auth instead of optionalAuth() ...
}
```

### Step 3: Create Aggregate Endpoint

```typescript
// src/app/api/maps/[id]/data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getRequestAuth } from '@/lib/security/authContext';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      const { id } = await params;
      const auth = await getRequestAuth(req); // Uses cache
      
      const supabase = auth?.userId
        ? await createServerClientWithAuth(cookies())
        : createServerClient();
      
      // Parallel queries
      const [mapResult, statsResult, pinsResult, areasResult, membersResult] = await Promise.all([
        // Map
        supabase
          .from('map')
          .select(`
            id, account_id, name, description, slug, visibility, settings,
            member_count, is_active, auto_approve_members, membership_rules,
            membership_questions, tags, created_at, updated_at,
            account:accounts!map_account_id_fkey(id, username, first_name, last_name, image_url)
          `)
          .eq('is_active', true)
          .or(`id.eq.${id},slug.eq.${id}`)
          .maybeSingle(),
        
        // Stats
        supabase
          .from('map_stats')
          .select('total_views, total_pins, total_areas')
          .eq('map_id', id)
          .maybeSingle(),
        
        // Pins
        supabase
          .from('map_pins')
          .select('*')
          .eq('map_id', id)
          .eq('is_active', true),
        
        // Areas
        supabase
          .from('map_areas')
          .select('*')
          .eq('map_id', id)
          .eq('is_active', true),
        
        // Members (only if authenticated)
        auth?.userId
          ? supabase
              .from('map_members')
              .select('*, account:accounts!map_members_account_id_fkey(id, username, first_name, last_name, image_url)')
              .eq('map_id', id)
          : Promise.resolve({ data: null, error: null }),
      ]);
      
      if (mapResult.error || !mapResult.data) {
        return NextResponse.json(
          { error: 'Map not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        map: mapResult.data,
        stats: statsResult.data || { total_views: 0, total_pins: 0, total_areas: 0 },
        pins: pinsResult.data || [],
        areas: areasResult.data || [],
        members: membersResult.data || null,
      }, {
        headers: {
          'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
        },
      });
    }
  );
}
```

### Step 4: Update Map Page

```typescript
// src/app/map/[id]/page.tsx
// Replace the fetchMapAndStats useEffect:

useEffect(() => {
  if (!mapId) return;
  
  let cancelled = false;
  
  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/maps/${mapId}/data`);
      const data = await response.json();
      
      if (cancelled) return;
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Map not found');
        } else if (response.status === 403) {
          setError('You do not have access to this map');
        } else {
          setError(data.error || 'Failed to load map');
        }
        setLoading(false);
        return;
      }
      
      setMapData(data.map);
      setViewCount(data.stats?.total_views || 0);
      
      // Pass data to MapIDBox via props or context
      // Update MapIDBox to accept initialPins and initialAreas
      
      // Record view (fire and forget)
      if (!hasRecordedView) {
        setHasRecordedView(true);
        fetch('/api/analytics/map-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            map_id: data.map.id,
            referrer_url: typeof window !== 'undefined' ? document.referrer || null : null,
            session_id: localStorage.getItem('analytics_device_id') || generateUUID(),
            user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
          }),
        }).catch(() => {});
      }
    } catch (err) {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'Failed to load map');
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };
  
  fetchAll();
  
  return () => {
    cancelled = true;
  };
}, [mapId, hasRecordedView]);
```

### Step 5: Update MapIDBox to Accept Initial Data

```typescript
// src/app/map/[id]/components/MapIDBox.tsx
// Add props:
interface MapIDBoxProps {
  // ... existing props
  initialPins?: MapPin[];
  initialAreas?: MapArea[];
}

// Update component:
export default function MapIDBox({
  // ... existing props
  initialPins = [],
  initialAreas = [],
}: MapIDBoxProps) {
  // Remove the pins/areas fetch useEffect
  // Use initialPins/initialAreas as initial state
  const [pins, setPins] = useState<MapPin[]>(initialPins);
  const [areas, setAreas] = useState<MapArea[]>(initialAreas);
  
  // Keep refresh logic for updates, but skip initial fetch
}
```

### Step 6: Update useMapMembership

```typescript
// src/app/map/[id]/hooks/useMapMembership.ts
// Accept initial members data:
export function useMapMembership(
  mapId: string | null,
  mapAccountId: string | null,
  initialMembers?: any[]
) {
  // Use initialMembers if provided, otherwise fetch
  // This avoids duplicate fetch if members already loaded
}
```

---

## Expected Results

**Before:**
- 6 API calls
- 6-8 auth checks (1.6-9.6s overhead)
- Sequential loading

**After:**
- 1 API call (+ 1 analytics POST)
- 1 auth check (0.2-1s overhead)
- Parallel data loading
- **80% reduction in auth overhead**
- **83% reduction in API calls**

---

## iOS App Compatibility

- Uses standard `fetch()` API (works in iOS standalone)
- No server-side rendering dependencies
- Same network behavior as web
- No changes needed for iOS app

---

## Rollout Plan

1. **Add auth cache** (5 min) - No breaking changes
2. **Create aggregate endpoint** (30 min) - New endpoint, old ones still work
3. **Update map page** (20 min) - Switch to new endpoint
4. **Test** (10 min)
5. **Remove old endpoints** (optional, later)

**Total: ~1 hour**

---

## Notes

- Keep old endpoints temporarily for rollback
- Analytics POST stays separate (fire-and-forget)
- Members only fetched if authenticated (handled in endpoint)
- Cache headers added for browser caching
- No React Query needed (simple fetch works)
- No PostGIS needed (can add viewport filtering later if needed)
