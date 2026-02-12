# Complete Caching System - Technical Implementation Plan

**Goal:** Transform 30+ independent data fetches into a unified caching system

---

## Current State (What We Have Now)

### Problem: Scattered Fetches
- **30+ components** fetch `mention_types` independently
- **10+ components** fetch map data independently  
- **5+ components** fetch account data independently
- **No sharing** - each component fetches its own copy
- **No deduplication** - same request = multiple database calls

### Example: Mention Types
```
Component A loads → Fetches mention_types → Stores in useState
Component B loads → Fetches mention_types → Stores in useState  
Component C loads → Fetches mention_types → Stores in useState
...
= 30+ database calls for the same data
```

---

## Target State (What We're Building)

### Solution: Unified Cache
- **1 query function** defines how to fetch each data type
- **1 cache** stores fetched data globally
- **All components** share the same cached data
- **Automatic deduplication** - same request = 1 database call

### Example: Mention Types (After)
```
Component A loads → useQuery(mentionTypeQueries.all()) → Fetches → Stores in cache
Component B loads → useQuery(mentionTypeQueries.all()) → Uses cache (no fetch!)
Component C loads → useQuery(mentionTypeQueries.all()) → Uses cache (no fetch!)
...
= 1 database call, shared everywhere
```

---

## Technical Implementation Steps

### Phase 1: Foundation ✅ (COMPLETE)

**What we did:**
1. ✅ Installed React Query
2. ✅ Created QueryClient configuration
3. ✅ Created query functions for 4 tables:
   - `mapQueries` - Maps with aggregate endpoint
   - `accountQueries` - Accounts + profiles unified
   - `mentionTypeQueries` - Mention types with long cache
   - `atlasQueries` - Cities/counties with long cache
4. ✅ Added QueryClientProvider to app

**Result:** Infrastructure ready, but not used yet

---

### Phase 2: Migrate Mention Types (Week 1)

**Technical Steps:**

#### Step 1: Find All Components Fetching Mention Types
**Found:** 30+ files fetching `mention_types` directly

**Files to migrate:**
- `src/components/feed/MentionTypeFilter.tsx`
- `src/components/layout/MentionTypeFilterContent.tsx`
- `src/components/layout/CreateMentionPopup.tsx`
- `src/components/layout/HeaderMentionTypeCards.tsx`
- `src/components/feed/CreatePostModal.tsx`
- `src/app/map/[id]/post/[postId]/edit/page.tsx`
- `src/app/mention/[id]/edit/page.tsx`
- ... (23 more files)

#### Step 2: Replace Each Component (One at a time)

**BEFORE (Current Code):**
```typescript
// src/components/feed/MentionTypeFilter.tsx
const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchMentionTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('mention_types')
        .select('id, emoji, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setMentionTypes((data || []).map(type => ({
        ...type,
        slug: mentionTypeNameToSlug(type.name),
      })));
    } catch (error) {
      console.error('Failed to fetch mention types:', error);
    } finally {
      setLoading(false);
    }
  };
  fetchMentionTypes();
}, []);
```

**AFTER (With React Query):**
```typescript
// src/components/feed/MentionTypeFilter.tsx
import { useQuery } from '@tanstack/react-query';
import { mentionTypeQueries } from '@/lib/data/queries';

const { data: mentionTypes = [], isLoading: loading } = useQuery(mentionTypeQueries.all());
```

**What happens:**
1. Component calls `useQuery(mentionTypeQueries.all())`
2. React Query checks cache: "Do I have `['mentionTypes', 'all']`?"
3. **First component:** Cache empty → Fetches from database → Stores in cache
4. **All other components:** Cache exists → Returns cached data instantly (no fetch!)

#### Step 3: Remove Old Code
- Delete `useState` for mention types
- Delete `useEffect` fetch logic
- Delete manual loading state
- Delete error handling (React Query handles it)

#### Step 4: Test
- Verify component loads correctly
- Verify data appears
- Check browser Network tab - should see 1 fetch, not 30

**Result After Phase 2:**
- ✅ 30+ components → 1 database call
- ✅ Global cache shared across entire app
- ✅ Automatic loading/error states
- ✅ Data stays fresh for 1 hour (staleTime)

---

### Phase 3: Migrate Maps (Week 2)

**Technical Steps:**

#### Step 1: Find Components Using Map Data
**Found:** 10+ files fetching map data

**Files to migrate:**
- `src/app/map/[id]/page.tsx` - Main map page
- `src/app/map/[id]/hooks/useMapPageData.ts` - Map data hook
- `src/components/layout/PageWrapper.tsx` - Map info in header
- `src/app/live/page.tsx` - Live map page
- ... (6 more files)

#### Step 2: Replace Map Fetches

**BEFORE (Current Code):**
```typescript
// src/app/map/[id]/hooks/useMapPageData.ts
const [map, setMap] = useState(null);
const [pins, setPins] = useState([]);
const [areas, setAreas] = useState([]);
const [members, setMembers] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    // Fetch map
    const mapRes = await fetch(`/api/maps/${mapId}`);
    const mapData = await mapRes.json();
    setMap(mapData);
    
    // Fetch pins
    const pinsRes = await fetch(`/api/maps/${mapId}/pins`);
    const pinsData = await pinsRes.json();
    setPins(pinsData);
    
    // Fetch areas
    const areasRes = await fetch(`/api/maps/${mapId}/areas`);
    const areasData = await areasRes.json();
    setAreas(areasData);
    
    // Fetch members
    const membersRes = await fetch(`/api/maps/${mapId}/members`);
    const membersData = await membersRes.json();
    setMembers(membersData);
    
    setLoading(false);
  };
  fetchData();
}, [mapId]);
```

**AFTER (With React Query + Aggregate Endpoint):**
```typescript
// src/app/map/[id]/hooks/useMapPageData.ts
import { useQuery } from '@tanstack/react-query';
import { mapQueries } from '@/lib/data/queries';

const { data, isLoading: loading } = useQuery(mapQueries.byId(mapId));

const map = data?.map;
const pins = data?.pins || [];
const areas = data?.areas || [];
const members = data?.members || [];
```

**What happens:**
1. Component calls `useQuery(mapQueries.byId(mapId))`
2. Query function calls `/api/maps/${mapId}/data` (aggregate endpoint)
3. **Aggregate endpoint returns:** `{ map, stats, pins, areas, members }` in 1 call
4. React Query stores entire response in cache: `['map', mapId]`
5. **Other components:** Same map ID → Uses cache (no fetch!)

**Benefits:**
- ✅ 4 API calls → 1 API call (aggregate endpoint)
- ✅ Cache shared across all components viewing same map
- ✅ Navigate away and back → Instant load from cache

#### Step 3: Update Components Using Map Data
- Replace separate fetches with `useQuery(mapQueries.byId(id))`
- Use `data.map`, `data.pins`, `data.areas`, `data.members`
- Remove manual state management

**Result After Phase 3:**
- ✅ Map pages: 4 API calls → 1 API call
- ✅ Cache shared: View map → Navigate away → Come back = instant load
- ✅ All map-related data cached together

---

### Phase 4: Migrate Accounts (Week 2)

**Technical Steps:**

#### Step 1: Find Components Fetching Account Data
**Found:** 5+ files fetching accounts

**Files to migrate:**
- Components using `/api/accounts/current`
- Components using `AccountService.getCurrentAccount()`
- Profile pages fetching by username

#### Step 2: Replace Account Fetches

**BEFORE:**
```typescript
const [account, setAccount] = useState(null);
useEffect(() => {
  fetch('/api/accounts/current')
    .then(r => r.json())
    .then(setAccount);
}, []);
```

**AFTER:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { accountQueries } from '@/lib/data/queries';

const { data: account } = useQuery(accountQueries.current());
```

**What happens:**
- Current user's account cached globally
- All components share same account data
- Profile pages use `accountQueries.byUsername(username)`
- Cache key: `['account', 'current']` or `['account', username]`

**Result After Phase 4:**
- ✅ Account data cached globally
- ✅ Profile pages share cache
- ✅ No duplicate account fetches

---

### Phase 5: Migrate Cities/Counties (Week 3)

**Technical Steps:**

#### Step 1: Find Components Fetching Locations
**Found:** Feed page fetches cities/counties server-side

**Files to migrate:**
- `src/app/feed/page.tsx` - Server-side fetch
- Components using cities/counties data

#### Step 2: Replace Location Fetches

**BEFORE (Server-Side):**
```typescript
// src/app/feed/page.tsx (server component)
const cities = await getCitiesData(); // Fetches on every request
const counties = await getCountiesData(); // Fetches on every request
```

**AFTER (Client-Side with Cache):**
```typescript
// src/components/feed/CitiesAndCountiesSidebar.tsx (client component)
import { useQuery } from '@tanstack/react-query';
import { atlasQueries } from '@/lib/data/queries';

const { data: locations } = useQuery(atlasQueries.locations());

const cities = locations?.cities || [];
const counties = locations?.counties || [];
```

**What happens:**
- First load: Fetches cities + counties → Stores in cache (24 hour staleTime)
- Subsequent loads: Uses cache (no fetch!)
- Cache persists across page navigations
- Only refetches after 24 hours

**Result After Phase 5:**
- ✅ Cities/counties cached for 24 hours
- ✅ Feed page loads instantly (after first load)
- ✅ No server-side fetch on every request

---

## Complete Caching System Architecture

### How It Works Technically

```
┌─────────────────────────────────────────────────────────┐
│                    React Query Cache                    │
│  (Global in-memory cache, shared across all components) │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Cache Keys → Data:                                     │
│                                                         │
│  ['mentionTypes', 'all'] → [ {...}, {...}, ... ]       │
│  ['map', 'abc-123'] → { map, pins, areas, members }    │
│  ['account', 'current'] → { id, name, ... }            │
│  ['atlas', 'cities'] → [ {...}, {...}, ... ]           │
│  ['atlas', 'counties'] → [ {...}, {...}, ... ]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          ↑
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
   Component A                         Component B
   useQuery(...)                       useQuery(...)
        │                                   │
        └─────────────────┬─────────────────┘
                          │
                    Same Query Key?
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
    Cache Hit                          Cache Miss
    (Instant)                         (Fetch + Cache)
```

### Cache Lifecycle

1. **Component calls `useQuery(queryFunction)`**
   - Query function returns `{ queryKey: [...], queryFn: async () => {...} }`

2. **React Query checks cache**
   - Looks for data at `queryKey`
   - Checks if data is "stale" (older than `staleTime`)

3. **Cache Hit (Fresh Data)**
   - Returns cached data immediately
   - No network request
   - Component renders instantly

4. **Cache Miss OR Stale Data**
   - Calls `queryFn()` to fetch data
   - Stores result in cache at `queryKey`
   - Returns data to component
   - Other components using same `queryKey` get cached data

5. **Background Refetch**
   - If data is stale but still in cache
   - Shows cached data immediately
   - Fetches fresh data in background
   - Updates cache when fresh data arrives

---

## Technical Outcomes

### Before Migration
```
Page Load Sequence:
1. Feed page loads
2. Component A fetches mention_types (DB call #1)
3. Component B fetches mention_types (DB call #2)
4. Component C fetches mention_types (DB call #3)
5. Map page loads
6. Fetches map (API call #1)
7. Fetches pins (API call #2)
8. Fetches areas (API call #3)
9. Fetches members (API call #4)
10. Navigate back to feed
11. Component A fetches mention_types again (DB call #4)
...
= 50+ database/API calls per user session
```

### After Migration
```
Page Load Sequence:
1. Feed page loads
2. Component A calls useQuery(mentionTypes) → Fetches → Caches
3. Component B calls useQuery(mentionTypes) → Uses cache (no fetch!)
4. Component C calls useQuery(mentionTypes) → Uses cache (no fetch!)
5. Map page loads
6. Calls useQuery(map) → Fetches aggregate endpoint → Caches
7. Navigate back to feed
8. Component A calls useQuery(mentionTypes) → Uses cache (no fetch!)
...
= 2-5 database/API calls per user session (90% reduction)
```

---

## Migration Checklist

### Mention Types (30+ files)
- [ ] `src/components/feed/MentionTypeFilter.tsx`
- [ ] `src/components/layout/MentionTypeFilterContent.tsx`
- [ ] `src/components/layout/CreateMentionPopup.tsx`
- [ ] `src/components/layout/HeaderMentionTypeCards.tsx`
- [ ] `src/components/feed/CreatePostModal.tsx`
- [ ] `src/app/map/[id]/post/[postId]/edit/page.tsx`
- [ ] `src/app/mention/[id]/edit/page.tsx`
- [ ] ... (23 more files)

### Maps (10+ files)
- [ ] `src/app/map/[id]/page.tsx`
- [ ] `src/app/map/[id]/hooks/useMapPageData.ts`
- [ ] `src/components/layout/PageWrapper.tsx`
- [ ] `src/app/live/page.tsx`
- [ ] ... (6 more files)

### Accounts (5+ files)
- [ ] Components using `/api/accounts/current`
- [ ] Profile pages
- [ ] Account dropdown components

### Cities/Counties (3+ files)
- [ ] `src/app/feed/page.tsx` (server-side)
- [ ] `src/components/feed/CitiesAndCountiesSidebar.tsx`
- [ ] Location filter components

---

## Success Metrics

### Performance
- **API calls:** 90% reduction (50+ → 5 per session)
- **Page load time:** 50% faster (cache hits = instant)
- **Database load:** 80% reduction

### Code Quality
- **Lines of code:** 70% reduction (no manual fetch logic)
- **Consistency:** All data fetching uses same pattern
- **Maintainability:** One place to change fetch logic

### User Experience
- **Navigation:** Instant loads when revisiting pages
- **Loading states:** Consistent across all components
- **Error handling:** Unified error states

---

## Final Architecture

```
┌─────────────────────────────────────────────────────┐
│              React Query Cache (Global)              │
│  - Mention Types: 1 hour cache                      │
│  - Maps: 5 minute cache                             │
│  - Accounts: 5 minute cache                          │
│  - Cities/Counties: 24 hour cache                   │
└─────────────────────────────────────────────────────┘
                          ↑
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
   Query Functions                    Components
   (src/lib/data/queries/)           (useQuery hooks)
        │                                   │
        │                                   │
   API Endpoints                    React Query
   (/api/maps/[id]/data)            (Automatic caching)
```

**Result:** Complete caching system where:
- ✅ All data fetching goes through unified layer
- ✅ Automatic caching with smart invalidation
- ✅ Request deduplication
- ✅ Background refetching
- ✅ Optimistic updates (future)
- ✅ 90% reduction in API calls
