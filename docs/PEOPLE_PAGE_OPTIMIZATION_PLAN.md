# People Page Optimization Plan

## Current Performance Issues

### 1. **Duplicate API Calls (Critical)**
- `PeopleLeftSidebar`: Fetches `/api/social/edges/${account.id}` for stats
- `PeopleRightSidebar`: Fetches `/api/social/edges/${account.id}` for friends
- `PeopleTabContent`: Fetches `/api/social/edges/${account.id}` for tabs
- `PersonCard` (N+1): Each card fetches `/api/social/edges/${account.id}` to check relationship
- **Result**: Same endpoint called 4+ times on page load, then N times for each person card

### 2. **N+1 Problem in PeopleTabContent**
- Fetches edges, then loops through and fetches `/api/accounts/${id}` for each person
- **Result**: 1 + N API calls instead of 1 batch call

### 3. **N+1 Problem in PersonCard**
- Each card fetches ALL edges just to find one relationship
- **Result**: If 20 people shown, 20 duplicate edge fetches

### 4. **No Data Sharing**
- Each component independently manages state
- No caching or deduplication
- Same data fetched multiple times

## Senior Dev Solution

### Phase 1: Create Social Graph Query Functions (React Query)

**Create:** `src/lib/data/queries/socialGraph.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';

export const socialGraphQueries = {
  // Single source of truth for edges
  edges: (accountId: string) => ({
    queryKey: ['social-graph', 'edges', accountId],
    queryFn: async () => {
      const res = await fetch(`/api/social/edges/${accountId}`);
      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  }),

  // Batch account fetching
  accountsBatch: (accountIds: string[]) => ({
    queryKey: ['accounts', 'batch', accountIds.sort().join(',')],
    queryFn: async () => {
      const res = await fetch('/api/accounts/batch', {
        method: 'POST',
        body: JSON.stringify({ ids: accountIds }),
      });
      return res.json();
    },
  }),
};
```

### Phase 2: Create Batch Accounts Endpoint

**Create:** `src/app/api/accounts/batch/route.ts`

```typescript
// POST /api/accounts/batch
// Accepts: { ids: string[] }
// Returns: { accounts: Account[] }
// Single query instead of N queries
```

### Phase 3: Create Combined Endpoint (Optional but Better)

**Create:** `src/app/api/social/edges/[accountId]/with-accounts/route.ts`

```typescript
// GET /api/social/edges/[accountId]/with-accounts
// Returns edges with account details joined
// Eliminates need for separate account fetches
```

### Phase 4: Refactor Components

1. **PeoplePage**: Fetch edges once using React Query, pass down via context
2. **PersonCard**: Use shared edges data instead of fetching
3. **PeopleTabContent**: Use batch endpoint for accounts
4. **Sidebars**: Use shared React Query cache

## Expected Performance Gains

### Before:
- Page load: 4+ edge fetches + N person card fetches + N account fetches
- Example: 20 people = 4 + 20 + 20 = **44 API calls**

### After:
- Page load: 1 edge fetch (cached) + 1 batch account fetch
- Example: 20 people = 1 + 1 = **2 API calls**
- **95% reduction in API calls**

## Implementation Priority

1. ✅ **High**: Create social graph query functions
2. ✅ **High**: Create batch accounts endpoint
3. ✅ **Medium**: Refactor PersonCard to use shared edges
4. ✅ **Medium**: Refactor PeopleTabContent to use batch
5. ✅ **Low**: Create combined endpoint (nice-to-have)
