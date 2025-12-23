# Feed Page Performance Analysis

## Current Load Sequence

### Server-Side (Initial Page Load)
**File: `src/app/feed/page.tsx`**

1. **Fetch ALL cities** (parallel)
   - Query: `SELECT id, name, slug, population, county FROM cities ORDER BY population DESC`
   - Returns: All cities in database (potentially hundreds/thousands)
   - Cached via React `cache()` but still executes on first load
   - **Heavy**: Full table scan with ordering

2. **Fetch ALL counties** (parallel)
   - Query: `SELECT id, name, slug, population, area_sq_mi FROM counties ORDER BY name ASC`
   - Returns: All counties in database (87 for Minnesota)
   - Cached via React `cache()` but still executes on first load
   - **Heavy**: Full table scan with ordering

3. **Data processing**
   - Filters cities/counties to only those with slugs
   - Formats population numbers
   - Maps to component structure

### Client-Side (After Hydration)
**File: `src/components/feed/FeedListClient.tsx`**

4. **Page view tracking** (immediate, async)
   - **File**: `src/hooks/usePageView.ts`
   - **API**: `POST /api/analytics/view`
   - **File**: `src/app/api/analytics/view/route.ts`
   - Calls `record_page_view()` RPC function
   - Fetches account if authenticated
   - **Medium**: Separate database write operation

5. **Account data fetch** (if authenticated)
   - **File**: `src/features/auth/services/memberService.ts` → `AccountService.getCurrentAccount()`
   - Query: `SELECT * FROM accounts WHERE user_id = ? LIMIT 1`
   - **Medium**: Single row lookup (indexed)

6. **Feed posts fetch** (immediate, blocking)
   - **File**: `src/app/api/feed/route.ts`
   - **CRITICAL BOTTLENECK**
   - Query 1: `SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 0`
     - RLS policy evaluates `user_owns_account(account_id)` for EVERY row
     - **Heavy**: Function call per row, even for public posts
   - Query 2: `SELECT id, first_name, last_name, image_url FROM accounts WHERE id IN (...)`
     - Fetches account data for all post authors
     - **Medium**: Batch lookup (indexed)

7. **Feed stats fetch** (immediate, async)
   - **File**: `src/components/feed/FeedStatsCard.tsx`
   - **API**: `GET /api/analytics/feed-stats?hours=24`
   - **File**: `src/app/api/analytics/feed-stats/route.ts`
   - Calls `get_feed_stats()` RPC function
   - **Medium**: Aggregation query on page_views table

## Heaviest Operations (Ranked)

### 1. Feed Posts Query - **CRITICAL** ⚠️
**File**: `src/app/api/feed/route.ts` (lines 63-130)

**Problem**:
- RLS policy `posts_select_authenticated` calls `user_owns_account(account_id)` for every row
- Even though PostgreSQL should short-circuit OR conditions, it may evaluate function for all rows
- Function does: `SELECT 1 FROM accounts WHERE id = ? AND user_id = auth.uid()`
- With many posts, this becomes N+1 query pattern

**Current Logic**:
```typescript
// Line 63-67: Main query
let query = supabase
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);

// Lines 114-130: Separate accounts fetch
const accountIds = [...new Set((posts || []).map((p: FeedPost) => p.account_id).filter(Boolean))];
const { data: accounts } = await supabase
  .from('accounts')
  .select('id, first_name, last_name, image_url')
  .in('id', accountIds);
```

**RLS Policy** (from migration 148):
```sql
CREATE POLICY "posts_select_authenticated"
  ON public.posts FOR SELECT
  TO authenticated
  USING (visibility = 'public' OR public.user_owns_account(account_id));
```

**Impact**: Causes 500 timeout errors when posts table is large

---

### 2. Cities/Counties Fetch - **HEAVY** ⚠️
**File**: `src/app/feed/page.tsx` (lines 19-45)

**Problem**:
- Fetches ALL cities and counties on every page load
- Only used in right sidebar (`CitiesAndCountiesSidebar`)
- Full table scans with ordering

**Current Logic**:
```typescript
// Lines 19-31: Cities
const getCitiesData = cache(async () => {
  const { data } = await supabase
    .from('cities')
    .select('id, name, slug, population, county')
    .order('population', { ascending: false }); // Full table scan
  return data || [];
});

// Lines 33-45: Counties
const getCountiesData = cache(async () => {
  const { data } = await supabase
    .from('counties')
    .select('id, name, slug, population, area_sq_mi')
    .order('name', { ascending: true }); // Full table scan
  return data || [];
});
```

**Impact**: Unnecessary data transfer, slow initial load

---

### 3. Feed Stats Query - **MEDIUM**
**File**: `src/components/feed/FeedStatsCard.tsx` (lines 29-53)

**Problem**:
- Separate analytics query on every page load
- Not critical for initial render
- Could be lazy loaded or cached

**Current Logic**:
```typescript
useEffect(() => {
  const fetchStats = async () => {
    const response = await fetch(`/api/analytics/feed-stats?hours=${timePeriod}`);
    const data = await response.json();
    setStats(data);
  };
  fetchStats();
}, [timePeriod]);
```

**Impact**: Additional database query, blocks sidebar render

---

### 4. Account Fetch - **MEDIUM**
**File**: `src/components/feed/FeedListClient.tsx` (lines 55-72)

**Problem**:
- Client-side fetch when could be server-side
- Duplicates auth check already done in API route

**Current Logic**:
```typescript
useEffect(() => {
  const loadAccount = async () => {
    if (!user) return;
    const accountData = await AccountService.getCurrentAccount();
    setAccount(accountData);
  };
  loadAccount();
}, [user]);
```

**Impact**: Extra round trip, but relatively fast (indexed lookup)

---

### 5. Page View Tracking - **LOW**
**File**: `src/hooks/usePageView.ts`

**Problem**:
- Separate POST request
- Not critical for page functionality
- Already async, but could be deferred further

**Impact**: Minimal, already non-blocking

---

## Optimization Opportunities

### Priority 1: Fix Feed Posts Query (CRITICAL)

**Option A: Optimize RLS Policy** ✅ (Already done in migration 176)
- Add indexes on `posts(visibility, account_id)` and `accounts(user_id)`
- Optimize `user_owns_account()` function
- **File**: `supabase/migrations/176_optimize_posts_rls_performance.sql`

**Option B: Reduce RLS Evaluation**
- Filter by `visibility = 'public'` in query when no auth needed
- **File**: `src/app/api/feed/route.ts` line 63
- **Change**: Add `.eq('visibility', 'public')` for anonymous users

**Option C: Join Accounts in Single Query**
- Use Supabase join syntax to fetch accounts with posts
- **File**: `src/app/api/feed/route.ts` line 63
- **Change**: `.select('*, accounts(id, first_name, last_name, image_url)')`
- **Benefit**: Eliminates separate accounts query

**Option D: Use Service Role for Feed**
- Bypass RLS for public feed queries
- **Risk**: Security consideration, but feed is public anyway
- **File**: `src/app/api/feed/route.ts`

---

### Priority 2: Lazy Load Cities/Counties (HIGH)

**Option A: Client-Side Fetch**
- Remove from server component
- Fetch in `CitiesAndCountiesSidebar` component
- **File**: `src/components/locations/CitiesAndCountiesSidebar.tsx`
- **Benefit**: Doesn't block initial page load

**Option B: Limit Results**
- Only fetch top N cities by population
- **File**: `src/app/feed/page.tsx` line 24
- **Change**: Add `.limit(50)` to cities query

**Option C: Static Generation**
- Pre-generate cities/counties list at build time
- **File**: `src/app/feed/page.tsx`
- **Change**: Use static data or ISR

---

### Priority 3: Defer Feed Stats (MEDIUM)

**Option A: Lazy Load on Scroll/View**
- Only fetch when user scrolls to sidebar
- **File**: `src/components/feed/FeedStatsCard.tsx`
- **Change**: Use Intersection Observer

**Option B: Cache with Revalidation**
- Cache stats for 5 minutes
- **File**: `src/app/api/analytics/feed-stats/route.ts`
- **Change**: Add Next.js caching headers

**Option C: Remove from Initial Load**
- Make stats optional/expandable
- **File**: `src/components/feed/FeedStatsCard.tsx`

---

### Priority 4: Server-Side Account Fetch (LOW)

**Option A: Pass Account from Server**
- Fetch account in `page.tsx` server component
- Pass as prop to `FeedListClient`
- **File**: `src/app/feed/page.tsx`
- **File**: `src/components/feed/FeedListClient.tsx`

**Option B: Use Server Account in API**
- Account already fetched in feed API route
- Return account data with feed response
- **File**: `src/app/api/feed/route.ts`

---

## Recommended Quick Wins

1. **Add visibility filter for anonymous users** (5 min)
   - **File**: `src/app/api/feed/route.ts` line 63
   - **Change**: Add `.eq('visibility', 'public')` when `!user`

2. **Use Supabase join for accounts** (10 min)
   - **File**: `src/app/api/feed/route.ts` line 63
   - **Change**: `.select('*, accounts(id, first_name, last_name, image_url)')`
   - **Remove**: Lines 114-130 (separate accounts query)

3. **Lazy load cities/counties** (15 min)
   - **File**: `src/components/locations/CitiesAndCountiesSidebar.tsx`
   - **Change**: Fetch in component useEffect
   - **Remove**: From `src/app/feed/page.tsx`

4. **Defer feed stats** (10 min)
   - **File**: `src/components/feed/FeedStatsCard.tsx`
   - **Change**: Use Intersection Observer or delay 2 seconds

---

## Files to Share with AI Agent

### Critical Files (Must Review)
1. `src/app/api/feed/route.ts` - Feed API endpoint (main bottleneck)
2. `supabase/migrations/176_optimize_posts_rls_performance.sql` - RLS optimization
3. `supabase/migrations/148_fix_posts_rls_simple.sql` - Current RLS policies
4. `src/app/feed/page.tsx` - Server component (cities/counties fetch)

### Supporting Files (Context)
5. `src/components/feed/FeedListClient.tsx` - Client component
6. `src/components/feed/FeedStatsCard.tsx` - Stats component
7. `src/components/locations/CitiesAndCountiesSidebar.tsx` - Sidebar component
8. `src/hooks/usePageView.ts` - Page view tracking
9. `src/features/auth/services/memberService.ts` - Account service

### Database Schema (Reference)
10. `supabase/migrations/147_ensure_posts_complete.sql` - Posts table structure
11. `supabase/migrations/013_optimize_rls_policies.sql` - user_owns_account function

---

## Expected Performance Gains

| Optimization | Time Saved | Complexity |
|-------------|------------|------------|
| Fix RLS policy (migration 176) | 2-5s | Low ✅ |
| Add visibility filter | 1-2s | Low |
| Join accounts in query | 0.5-1s | Medium |
| Lazy load cities/counties | 0.5-1s | Low |
| Defer feed stats | 0.2s | Low |
| **Total** | **4-8s** | **Medium** |

---

## Questions for AI Agent

1. Can we use a materialized view for feed posts to bypass RLS?
2. Should we use database-level caching for cities/counties?
3. Is there a better RLS pattern that doesn't call functions per-row?
4. Can we use Postgres `LATERAL` joins to optimize the accounts fetch?
5. Should feed stats be pre-computed and stored in a cache table?






