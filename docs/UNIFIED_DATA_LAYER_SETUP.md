# Unified Data Layer Setup - Phase 1

**Status:** ✅ Foundation Complete  
**Date:** 2025-02-04

## What's Been Created

### 1. React Query Client (`src/lib/data/client.ts`)
- Centralized QueryClient configuration
- Optimized defaults for caching
- Shared instance across entire app

### 2. Query Functions (`src/lib/data/queries/`)

#### ✅ Maps (`maps.ts`)
- `mapQueries.byId(id)` - Uses aggregate endpoint `/api/maps/[id]/data`
- `mapQueries.list(filters)` - List maps with filters
- `mapQueries.feed()` - Infinite scroll feed

#### ✅ Accounts (`accounts.ts`)
- `accountQueries.current()` - Current authenticated user
- `accountQueries.byId(id)` - Account by ID
- `accountQueries.byUsername(username)` - Account by username (includes profile)
- `accountQueries.list(filters)` - List accounts

#### ✅ Mention Types (`mentionTypes.ts`)
- `mentionTypeQueries.all()` - All active mention types (global cache, 1 hour)
- `mentionTypeQueries.byId(id)` - Single mention type

#### ✅ Atlas (`atlas.ts`)
- `atlasQueries.cities()` - All cities (24 hour cache)
- `atlasQueries.counties()` - All counties (24 hour cache)
- `atlasQueries.locations()` - Cities + counties together

### 3. Provider Integration (`src/components/providers/Providers.tsx`)
- ✅ QueryClientProvider added to provider tree
- Wraps all other providers for global cache access

---

## Installation Required

**⚠️ IMPORTANT:** Install React Query before using:

```bash
pnpm add @tanstack/react-query
```

---

## Usage Examples

### Maps

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { mapQueries } from '@/lib/data/queries';

export default function MapPage({ mapId }: { mapId: string }) {
  const { data, isLoading, error } = useQuery(mapQueries.byId(mapId));

  if (isLoading) return <div>Loading map...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const { map, stats, pins, areas, members } = data;

  return (
    <div>
      <h1>{map.name}</h1>
      <p>Views: {stats.stats.total_views}</p>
      <p>Pins: {pins.length}</p>
    </div>
  );
}
```

### Accounts

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { accountQueries } from '@/lib/data/queries';

export default function ProfilePage({ username }: { username: string }) {
  const { data: account, isLoading } = useQuery(accountQueries.byUsername(username));

  if (isLoading) return <div>Loading...</div>;
  if (!account) return <div>Not found</div>;

  return (
    <div>
      <h1>{account.username}</h1>
      <p>{account.first_name} {account.last_name}</p>
    </div>
  );
}
```

### Mention Types (Global Cache)

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { mentionTypeQueries } from '@/lib/data/queries';

export default function MentionTypeFilter() {
  // This will be cached globally - only fetches once per hour
  const { data: mentionTypes, isLoading } = useQuery(mentionTypeQueries.all());

  if (isLoading) return <div>Loading types...</div>;

  return (
    <div>
      {mentionTypes.map(type => (
        <button key={type.id}>
          {type.emoji} {type.name}
        </button>
      ))}
    </div>
  );
}
```

### Cities/Counties (Long Cache)

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { atlasQueries } from '@/lib/data/queries';

export default function LocationFilter() {
  // Cached for 24 hours - only fetches once per day
  const { data: locations, isLoading } = useQuery(atlasQueries.locations());

  if (isLoading) return <div>Loading locations...</div>;

  return (
    <div>
      <h2>Cities</h2>
      {locations.cities.slice(0, 10).map(city => (
        <div key={city.id}>{city.name}</div>
      ))}
      
      <h2>Counties</h2>
      {locations.counties.map(county => (
        <div key={county.id}>{county.name}</div>
      ))}
    </div>
  );
}
```

---

## Migration Checklist

### Step 1: Install React Query
- [ ] Run `pnpm add @tanstack/react-query`
- [ ] Verify installation in `package.json`

### Step 2: Test Foundation
- [ ] Verify Providers component loads without errors
- [ ] Check browser console for React Query initialization

### Step 3: Migrate Components (One at a time)

#### Maps
- [ ] Find components using `/api/maps/[id]` or separate pin/area fetches
- [ ] Replace with `useQuery(mapQueries.byId(id))`
- [ ] Remove manual `useEffect` + `fetch` patterns
- [ ] Test map page loads correctly

#### Accounts
- [ ] Find components using `/api/accounts/current` or similar
- [ ] Replace with `useQuery(accountQueries.current())`
- [ ] Test account data loads correctly

#### Mention Types
- [ ] Find components fetching mention types directly from Supabase
- [ ] Replace with `useQuery(mentionTypeQueries.all())`
- [ ] Verify global cache works (fetch once, use everywhere)

#### Cities/Counties
- [ ] Find components fetching cities/counties on feed page
- [ ] Replace with `useQuery(atlasQueries.locations())`
- [ ] Verify 24-hour cache works

---

## Benefits

### ✅ Automatic Caching
- Data cached automatically based on `staleTime`
- No manual cache management needed

### ✅ Request Deduplication
- Multiple components requesting same data = single fetch
- React Query handles deduplication automatically

### ✅ Loading/Error States
- Built-in `isLoading`, `isError`, `error` states
- No manual state management needed

### ✅ Background Refetching
- Data refetches in background when stale
- Users see cached data immediately, fresh data loads silently

### ✅ Optimistic Updates
- Can add optimistic updates for mutations (future)

---

## Next Steps

1. **Install React Query** (required)
2. **Test one component** (start with mention types - easiest)
3. **Migrate incrementally** (one table at a time)
4. **Monitor performance** (use React Query DevTools)

---

## React Query DevTools (Optional)

For development, add DevTools to see cache state:

```typescript
// src/components/providers/Providers.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Add inside QueryClientProvider:
{process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
```

Install: `pnpm add -D @tanstack/react-query-devtools`

---

## Notes

- **Don't break existing code:** Migrate incrementally
- **Test each migration:** Verify data loads correctly
- **Remove old code:** After migration, remove manual `useEffect` + `fetch`
- **Cache is global:** Same query key = same cached data across components
