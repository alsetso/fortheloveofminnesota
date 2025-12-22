# Feed Page Performance - Deep Implementation Review

## A. src/app/api/feed/route.ts

### Current Feed Query Analysis

**Lines 63-67: Main Query**
```typescript
let query = supabase
  .from('posts')
  .select('*')  // ⚠️ PROBLEM: Selecting all columns
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

**Lines 110-130: Separate Accounts Query**
```typescript
const accountIds = [...new Set((posts || []).map((p: FeedPost) => p.account_id).filter(Boolean))];
const { data: accounts } = await supabase
  .from('accounts')
  .select('id, first_name, last_name, image_url')  // ✅ Good: explicit columns
  .in('id', accountIds);
```

### Issues Identified

1. **`.select('*')` on posts** - Fetches unnecessary columns (map_data JSONB, images JSONB, etc.)
2. **Two separate queries** - Posts query, then accounts query (extra round trip)
3. **No visibility filter for anonymous users** - RLS evaluates function for all rows
4. **OFFSET pagination** - Lines 37-38, 67: Uses `offset` which degrades with large datasets

### User Detection

**Line 33:**
```typescript
const { data: { user } } = await supabase.auth.getUser();
```

**Current logic:** No explicit visibility filter for anonymous users. RLS handles it, but we can optimize.

### Optimized Feed Query

```typescript
// Explicit column list - only what we need
const postsColumns = [
  'id',
  'account_id',
  'title',
  'content',
  'visibility',
  'images',
  'map_type',
  'map_geometry',
  'map_center',
  'map_screenshot',
  'map_hide_pin',
  'city',
  'county',
  'state',
  'created_at',
  'updated_at'
].join(', ');

// Build query with join for accounts
let query = supabase
  .from('posts')
  .select(`${postsColumns}, accounts(id, first_name, last_name, image_url)`)
  .order('created_at', { ascending: false });

// CRITICAL: Filter by visibility for anonymous users
if (!user) {
  query = query.eq('visibility', 'public');
}

// Apply location filters
if (city) query = query.eq('city', city);
if (county) query = query.eq('county', county);
if (state) query = query.eq('state', state);

// Apply visibility filter if specified
if (visibility && ['public', 'draft', 'members_only'].includes(visibility)) {
  query = query.eq('visibility', visibility);
} else if (visibility === 'only_me' && accountIdForOnlyMe) {
  query = query.eq('account_id', accountIdForOnlyMe).eq('visibility', 'only_me');
}

// Apply pagination
query = query.range(offset, offset + limit - 1);

const { data: posts, error } = await query;
```

**Benefits:**
- Single query with join (eliminates round trip)
- Explicit columns (reduces payload size)
- Visibility filter for anon (reduces RLS evaluation)
- Accounts data included in response

### Keyset Pagination Ready Version

```typescript
const { searchParams } = new URL(request.url);
const limit = parseInt(searchParams.get('limit') || '20', 10);
const cursor = searchParams.get('cursor'); // created_at timestamp or post id

let query = supabase
  .from('posts')
  .select(`${postsColumns}, accounts(id, first_name, last_name, image_url)`)
  .order('created_at', { ascending: false })
  .limit(limit + 1); // Fetch one extra to check hasMore

if (!user) {
  query = query.eq('visibility', 'public');
}

// Keyset pagination: cursor is the created_at of the last post
if (cursor) {
  query = query.lt('created_at', cursor);
}

const { data: posts, error } = await query;

// Check if there are more posts
const hasMore = posts && posts.length > limit;
const postsToReturn = hasMore ? posts.slice(0, limit) : (posts || []);
const nextCursor = postsToReturn.length > 0 
  ? postsToReturn[postsToReturn.length - 1].created_at 
  : null;

return NextResponse.json({
  posts: postsToReturn,
  hasMore,
  nextCursor,
});
```

---

## B. RLS + DB Layer

### Current `user_owns_account()` Function

**From migration 176 (lines 35-62):**
```sql
CREATE OR REPLACE FUNCTION public.user_owns_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM public.accounts
    WHERE id = account_id 
    AND user_id = current_user_id
    LIMIT 1
  );
END;
$$;
```

### Query Generation Analysis

**For a 20-row feed page with authenticated user:**

1. **Main query:** `SELECT * FROM posts WHERE ... ORDER BY created_at DESC LIMIT 20`
2. **RLS evaluation:** For each of 20 rows, PostgreSQL evaluates:
   - `visibility = 'public'` (fast, indexed)
   - OR `user_owns_account(account_id)` (function call)
3. **Function calls:** Even with short-circuiting, PostgreSQL may evaluate the function for non-public posts
4. **Inside function:** Each call does `SELECT 1 FROM accounts WHERE id = ? AND user_id = ?`

**Worst case:** 20 function calls × 1 account lookup = 20+ queries
**Best case (all public):** 0 function calls (short-circuited)

### Current Indexes

**From migration 176:**
```sql
-- ✅ EXISTS
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS posts_account_id_idx ON public.posts(account_id);
CREATE INDEX IF NOT EXISTS posts_visibility_idx ON public.posts(visibility);
CREATE INDEX IF NOT EXISTS posts_created_at_desc_idx ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_visibility_created_at_idx ON public.posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_visibility_account_id_idx ON public.posts(visibility, account_id) WHERE visibility != 'public';
```

**Missing Index:**
```sql
-- Composite index for authenticated user's own posts
CREATE INDEX IF NOT EXISTS posts_account_id_created_at_idx 
  ON public.posts(account_id, created_at DESC) 
  WHERE visibility != 'public';
```

### Alternative RLS Pattern

**Option 1: Materialized User Account IDs (Best Performance)**

```sql
-- Create a function that returns user's account IDs as array
CREATE OR REPLACE FUNCTION public.user_account_ids()
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  account_ids UUID[];
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  
  -- Single query to get all account IDs for user
  SELECT ARRAY_AGG(id) INTO account_ids
  FROM public.accounts
  WHERE user_id = current_user_id;
  
  RETURN COALESCE(account_ids, ARRAY[]::UUID[]);
END;
$$;

-- Updated RLS policy
CREATE POLICY "posts_select_authenticated"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'::public.post_visibility 
    OR account_id = ANY(public.user_account_ids())
  );
```

**Benefits:** Single function call per query (not per row)

**Option 2: Direct Join Pattern (Simplest)**

```sql
-- No function needed - direct check
CREATE POLICY "posts_select_authenticated"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'::public.post_visibility 
    OR EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = posts.account_id
      AND accounts.user_id = auth.uid()
    )
  );
```

**Note:** This may not be faster than function, but eliminates function overhead.

**Option 3: Separate Policies (Most Explicit)**

```sql
-- Policy 1: Public posts (no function call)
CREATE POLICY "posts_select_authenticated_public"
  ON public.posts FOR SELECT
  TO authenticated
  USING (visibility = 'public'::public.post_visibility);

-- Policy 2: Own posts (function call only for non-public)
CREATE POLICY "posts_select_authenticated_own"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    visibility != 'public'::public.post_visibility
    AND public.user_owns_account(account_id)
  );
```

**Benefits:** PostgreSQL can choose which policy to apply based on visibility filter

---

## C. src/app/feed/page.tsx

### Current Cities/Counties Fetch

**Lines 19-45:**
```typescript
const getCitiesData = cache(async () => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, slug, population, county')
    .order('population', { ascending: false }); // ⚠️ Full table scan
  return data || [];
});

const getCountiesData = cache(async () => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('counties')
    .select('id, name, slug, population, area_sq_mi')
    .order('name', { ascending: true }); // ⚠️ Full table scan
  return data || [];
});
```

**Line 49:** Executed on every request (even with cache, first request is slow)

### Optimized Version 1: Limit Results

```typescript
const getCitiesData = cache(async () => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, slug, population, county')
    .order('population', { ascending: false })
    .limit(50); // ✅ Only top 50 cities
  return data || [];
});

const getCountiesData = cache(async () => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('counties')
    .select('id, name, slug, population, area_sq_mi')
    .order('name', { ascending: true })
    .limit(25); // ✅ All counties (only 87 in MN, but limit for safety)
  return data || [];
});
```

### Optimized Version 2: Static JSON / ISR

**Create API endpoint:** `src/app/api/locations/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const supabase = createServerClient();
  
  const [cities, counties] = await Promise.all([
    supabase
      .from('cities')
      .select('id, name, slug, population, county')
      .order('population', { ascending: false })
      .limit(50),
    supabase
      .from('counties')
      .select('id, name, slug, population, area_sq_mi')
      .order('name', { ascending: true })
  ]);

  return NextResponse.json({
    cities: cities.data || [],
    counties: counties.data || [],
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
```

**Update page.tsx:**
```typescript
export default async function FeedPage() {
  // Don't fetch cities/counties here - let sidebar fetch them
  return (
    <SimplePageLayout contentPadding="px-0" footerVariant="light" hideFooter>
      <FeedListClient />
    </SimplePageLayout>
  );
}
```

### Optimized Version 3: Suspense Boundary

```typescript
import { Suspense } from 'react';
import CitiesAndCountiesSidebar from '@/components/locations/CitiesAndCountiesSidebar';

export default async function FeedPage() {
  return (
    <SimplePageLayout contentPadding="px-0" footerVariant="light" hideFooter>
      <FeedListClient>
        <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-md" />}>
          <CitiesAndCountiesSidebar />
        </Suspense>
      </FeedListClient>
    </SimplePageLayout>
  );
}
```

---

## D. src/components/feed/FeedListClient.tsx

### Current Client-Side Fetches

**On mount (lines 47-129):**
1. **Page view tracking** (line 48) - `usePageView` hook (async, non-blocking)
2. **Account fetch** (lines 55-72) - `AccountService.getCurrentAccount()` (if user exists)
3. **Feed posts** (lines 127-129) - `fetchPosts(true)` - **BLOCKING**

### Issues

1. **Line 124:** `fetchPosts` has `offset` in dependency array, causing potential re-fetches
   ```typescript
   // PROBLEMATIC CODE (current implementation):
   const fetchPosts = useCallback(async (reset = false) => {
     const currentOffset = reset ? 0 : offset; // Uses state
     // ... fetch logic
   }, [offset]); // ⚠️ offset in deps causes re-creation on every offset change
   ```
   **Problem:** Every time `offset` changes, `fetchPosts` is recreated, potentially triggering re-fetches.

2. **Line 55-72:** Account fetch duplicates work (API route already has user)
3. **No error state handling** - errors are logged but UI doesn't show them

### Optimized Version

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import FeedPost, { FeedPostData } from './FeedPost';
import { PostCreationCard } from '@/features/posts';
import MnudaHeroCard from './MnudaHeroCard';
import CitiesAndCountiesSidebar from '@/components/locations/CitiesAndCountiesSidebar';
import AccountViewsCard from './AccountViewsCard';
import PagesCard from './PagesCard';
import NavigationCard from './NavigationCard';
import CompactFooter from './CompactFooter';
import FeedStatsCard from './FeedStatsCard';
import { Account } from '@/features/auth';
import { useAuth } from '@/features/auth';
import { usePageView } from '@/hooks/usePageView';

interface FeedListClientProps {
  initialAccount?: Account | null; // Pass from server if available
}

export default function FeedListClient({ initialAccount = null }: FeedListClientProps) {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(initialAccount);
  const [posts, setPosts] = useState<FeedPostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0); // Use ref to avoid dependency issues

  // Track feed page views (non-blocking)
  usePageView({
    entity_type: 'feed',
    entity_slug: 'feed',
    enabled: true,
  });

  // Load account data only if not provided and user exists
  useEffect(() => {
    if (initialAccount) {
      setAccount(initialAccount);
      return;
    }

    if (!user) {
      setAccount(null);
      return;
    }

    // Fetch account if not provided
    const loadAccount = async () => {
      try {
        const { AccountService } = await import('@/features/auth');
        const accountData = await AccountService.getCurrentAccount();
        setAccount(accountData);
      } catch (error) {
        console.error('Error loading account:', error);
        setAccount(null);
      }
    };

    loadAccount();
  }, [user, initialAccount]);

  // Fetch posts - single source of truth
  const fetchPosts = useCallback(async (reset = false) => {
    if (reset) {
      offsetRef.current = 0;
      setIsLoading(true);
      setError(null);
    }
    
    try {
      const response = await fetch(
        `/api/feed?limit=20&offset=${offsetRef.current}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (reset) {
        setPosts(data.posts || []);
      } else {
        setPosts(prev => [...prev, ...(data.posts || [])]);
      }
      
      setHasMore(data.hasMore || false);
      offsetRef.current += (data.posts?.length || 0);
    } catch (error) {
      console.error('Error fetching feed:', error);
      setError(error instanceof Error ? error.message : 'Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  }, []); // ✅ No dependencies - uses ref

  // Load feed on mount
  useEffect(() => {
    fetchPosts(true);
  }, [fetchPosts]);

  const handlePostCreated = () => {
    fetchPosts(true);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore && !error) {
      fetchPosts();
    }
  };

  if (isLoading && posts.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="text-center text-gray-500 text-xs">Loading feed...</div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
          <p className="text-xs text-red-600 mb-2">{error}</p>
          <button
            onClick={() => fetchPosts(true)}
            className="text-xs text-red-700 hover:text-red-900 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-3">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Sidebar */}
        <div className="lg:col-span-3 hidden lg:block">
          <div className="lg:sticky lg:top-20 space-y-3 lg:[max-height:calc(100vh-5rem)]">
            <AccountViewsCard account={account} />
            <PagesCard account={account} />
            <NavigationCard />
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-6">
          <MnudaHeroCard />
          <PostCreationCard onPostCreated={handlePostCreated} />

          <div className="space-y-3 mt-3">
            {posts.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-md p-6 text-center">
                <p className="text-gray-500 mb-2 text-xs">No posts yet.</p>
                <p className="text-xs text-gray-400">Be the first to share something!</p>
              </div>
            ) : (
              posts.map((post) => (
                <FeedPost key={post.id} post={post} onUpdate={handlePostCreated} />
              ))
            )}
          </div>

          {error && posts.length > 0 && (
            <div className="mt-3 text-center text-xs text-red-600">
              {error} <button onClick={() => fetchPosts()} className="underline">Retry</button>
            </div>
          )}

          {posts.length > 0 && (
            <div className="mt-3 text-center">
              <button
                onClick={handleLoadMore}
                disabled={!hasMore || isLoading}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-md font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
              >
                {isLoading ? 'Loading...' : hasMore ? 'Load More' : 'No more posts'}
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-3 hidden lg:block">
          <div className="space-y-3">
            <FeedStatsCard />
            <CitiesAndCountiesSidebar />
            <CompactFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## E. src/components/feed/FeedStatsCard.tsx

### Current Implementation

**Lines 29-53:** Fetches immediately on mount, blocks sidebar render

### Optimized Version with Intersection Observer

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChartBarIcon, ClockIcon } from '@heroicons/react/24/outline';

interface FeedStats {
  total_loads: number;
  unique_visitors: number;
  accounts_active: number;
}

type TimePeriod = 24 | 168;

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default function FeedStatsCard() {
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(24);
  const [hasLoaded, setHasLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection Observer: only fetch when visible
  useEffect(() => {
    if (hasLoaded || !cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasLoaded) {
          setHasLoaded(true);
          fetchStats();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before visible
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [hasLoaded]);

  // Alternative: Delay fetch by 2 seconds (fallback if Intersection Observer not supported)
  useEffect(() => {
    if (hasLoaded) return;
    
    const timer = setTimeout(() => {
      if (!hasLoaded) {
        setHasLoaded(true);
        fetchStats();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasLoaded]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/feed-stats?hours=${timePeriod}`, {
        next: { revalidate: 300 }, // Cache for 5 minutes
      });
      
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching feed stats:', error);
      setStats({
        total_loads: 0,
        unique_visitors: 0,
        accounts_active: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // Refetch when time period changes
  useEffect(() => {
    if (hasLoaded) {
      fetchStats();
    }
  }, [timePeriod]);

  const toggleTimePeriod = () => {
    setTimePeriod(prev => prev === 24 ? 168 : 24);
  };

  if (!hasLoaded && !loading) {
    return (
      <div ref={cardRef} className="bg-white rounded-md border border-gray-200 p-[10px]">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const statsData = stats || {
    total_loads: 0,
    unique_visitors: 0,
    accounts_active: 0,
  };

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      {/* ... rest of component unchanged ... */}
    </div>
  );
}
```

---

## F. src/hooks/usePageView.ts

### Current Implementation

**Lines 21-68:** Already non-blocking (uses `.then()`, not `await`)

### Optimized Version with requestIdleCallback

```typescript
'use client';

import { useEffect, useRef } from 'react';

type EntityType = 'post' | 'city' | 'county' | 'profile' | 'account' | 'business' | 'page' | 'feed' | 'map';

interface UsePageViewOptions {
  entity_type: EntityType;
  entity_id?: string;
  entity_slug?: string;
  enabled?: boolean;
}

export function usePageView({ entity_type, entity_id, entity_slug, enabled = true }: UsePageViewOptions) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!enabled || hasTracked.current) return;
    if (!entity_id && !entity_slug) {
      console.warn('[usePageView] Skipping - no entity_id or entity_slug provided', { entity_type, entity_id, entity_slug });
      return;
    }

    hasTracked.current = true;

    const payload = {
      entity_type,
      entity_id: entity_id || null,
      entity_slug: entity_slug || null,
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout
    const trackView = () => {
      fetch('/api/analytics/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true, // ✅ Allows request to complete even if page unloads
      })
        .then(async (response) => {
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || error.message || `HTTP ${response.status}`);
          }
          return response.json();
        })
        .catch((error) => {
          // Silently fail - don't break the page
          console.error('[usePageView] Failed to track:', error.message || error, payload);
        });
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(trackView, { timeout: 2000 });
    } else {
      // Fallback: delay by 1 second
      setTimeout(trackView, 1000);
    }
  }, [entity_type, entity_id, entity_slug, enabled]);
}
```

**Changes:**
- `requestIdleCallback` for browser idle time
- `keepalive: true` for reliability
- 1s timeout fallback

---

## G. src/components/locations/CitiesAndCountiesSidebar.tsx

### Current Implementation

**Lines 22-25:** Receives heavy arrays as props from server

### Optimized Version: Self-Fetching

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface City {
  id: string;
  name: string;
  slug: string;
  population: string;
  county: string;
}

interface County {
  id: string;
  name: string;
  slug: string;
  population: string;
  area: string;
}

export default function CitiesAndCountiesSidebar() {
  const [cities, setCities] = useState<City[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCities, setShowAllCities] = useState(false);
  const [showAllCounties, setShowAllCounties] = useState(false);
  const displayCount = 5;

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Fetch from lightweight API endpoint
        const response = await fetch('/api/locations', {
          next: { revalidate: 3600 }, // Cache for 1 hour
        });
        
        if (!response.ok) throw new Error('Failed to fetch locations');
        
        const data = await response.json();
        
        // Format cities
        const formattedCities: City[] = (data.cities || []).map((city: any) => ({
          id: String(city.id),
          name: city.name,
          slug: city.slug,
          population: city.population?.toLocaleString('en-US') || '0',
          county: city.county || '',
        }));
        
        // Format counties
        const formattedCounties: County[] = (data.counties || []).map((county: any) => ({
          id: String(county.id),
          name: county.name,
          slug: county.slug,
          population: county.population?.toLocaleString('en-US') || '0',
          area: county.area_sq_mi 
            ? `${county.area_sq_mi.toLocaleString('en-US')} sq mi`
            : '0 sq mi',
        }));
        
        setCities(formattedCities);
        setCounties(formattedCounties);
      } catch (error) {
        console.error('Error fetching locations:', error);
        // Set empty arrays on error
        setCities([]);
        setCounties([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const hasMoreCities = cities.length > displayCount;
  const hasMoreCounties = counties.length > displayCount;
  const displayedCities = showAllCities ? cities : cities.slice(0, displayCount);
  const displayedCounties = showAllCounties ? counties : counties.slice(0, displayCount);

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      {/* ... rest of component unchanged ... */}
    </div>
  );
}
```

**Benefits:**
- Doesn't block page load
- Can be cached independently
- Lazy loads when sidebar is rendered

---

## Implementation Plan (8 Steps)

### Step 1: Optimize Feed API Query (LARGE impact, MEDIUM complexity)
**Files:** `src/app/api/feed/route.ts`
**Changes:**
- Replace `.select('*')` with explicit columns
- Add `.select('..., accounts(...)')` join
- Add `.eq('visibility', 'public')` for anonymous users
**Impact:** Eliminates separate accounts query, reduces payload, reduces RLS evaluation
**Estimated time:** 30 minutes

### Step 2: Add Visibility Filter for Anon (LARGE impact, LOW complexity)
**Files:** `src/app/api/feed/route.ts` (line 63)
**Changes:**
```typescript
if (!user) {
  query = query.eq('visibility', 'public');
}
```
**Impact:** Prevents RLS function calls for anonymous users
**Estimated time:** 5 minutes

### Step 3: Fix FeedListClient Dependencies (MEDIUM impact, LOW complexity)
**Files:** `src/components/feed/FeedListClient.tsx`
**Changes:**
- Use `useRef` for offset instead of state
- Remove `offset` from `fetchPosts` dependencies
- Add error state handling
**Impact:** Prevents unnecessary re-renders and re-fetches
**Estimated time:** 15 minutes

### Step 4: Defer Feed Stats Loading (SMALL impact, LOW complexity)
**Files:** `src/components/feed/FeedStatsCard.tsx`
**Changes:**
- Add Intersection Observer
- Add 2s delay fallback
**Impact:** Doesn't block sidebar render
**Estimated time:** 20 minutes

### Step 5: Lazy Load Cities/Counties (MEDIUM impact, MEDIUM complexity)
**Files:** 
- Create `src/app/api/locations/route.ts`
- Update `src/components/locations/CitiesAndCountiesSidebar.tsx`
- Update `src/app/feed/page.tsx`
**Changes:**
- Create lightweight API endpoint
- Move fetch to sidebar component
- Remove from server page
**Impact:** Doesn't block page load
**Estimated time:** 30 minutes

### Step 6: Optimize usePageView Hook (SMALL impact, LOW complexity)
**Files:** `src/hooks/usePageView.ts`
**Changes:**
- Add `requestIdleCallback`
- Add `keepalive: true`
**Impact:** Better browser resource usage
**Estimated time:** 10 minutes

### Step 7: Apply Migration 176 (LARGE impact, LOW complexity)
**Files:** Run migration
**Changes:** Apply `supabase/migrations/176_optimize_posts_rls_performance.sql`

**Migration 176 Key Details:**
```sql
-- Indexes created:
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS posts_account_id_idx ON public.posts(account_id);
CREATE INDEX IF NOT EXISTS posts_visibility_idx ON public.posts(visibility);
CREATE INDEX IF NOT EXISTS posts_created_at_desc_idx ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_visibility_created_at_idx ON public.posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_visibility_account_id_idx 
  ON public.posts(visibility, account_id) 
  WHERE visibility != 'public';

-- Optimized function:
CREATE OR REPLACE FUNCTION public.user_owns_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 
    FROM public.accounts
    WHERE id = account_id 
    AND user_id = current_user_id
    LIMIT 1
  );
END;
$$;
```

**Impact:** Optimizes RLS function and adds critical indexes for feed queries
**Estimated time:** 5 minutes (migration run)

### Step 8: Implement Keyset Pagination (MEDIUM impact, MEDIUM complexity) 🔴 HIGH PRIORITY
**Files:** `src/app/api/feed/route.ts`, `src/components/feed/FeedListClient.tsx`
**Changes:**
- Replace OFFSET with cursor-based pagination using `created_at`
- Update API to accept `cursor` parameter instead of `offset`
- Update client to track cursor and pass to API
**Impact:** Prevents performance degradation as posts table grows beyond 10k rows. OFFSET becomes exponentially slower.
**Estimated time:** 45 minutes

**Why this is higher priority:** OFFSET pagination requires scanning all previous rows. At 10k+ posts, this becomes a significant bottleneck. Keyset pagination uses indexed `created_at` for O(log n) performance.

### Step 9: Consider RLS Pattern Alternative (LARGE impact, HIGH complexity)
**Files:** New migration
**Changes:** Implement `user_account_ids()` function pattern (Option 1 from Section B)
**Impact:** Reduces function calls from N to 1 per query
**Estimated time:** 1 hour (testing required)

---

## Expected Performance Gains

| Step | Time Saved | Complexity | Priority |
|------|------------|------------|----------|
| 1. Optimize Feed Query | 1-2s | Medium | 🔴 High |
| 2. Visibility Filter | 0.5-1s | Low | 🔴 High |
| 3. Fix Dependencies | 0.2s | Low | 🟡 Medium |
| 4. Defer Stats | 0.1s | Low | 🟢 Low |
| 5. Lazy Load Locations | 0.5-1s | Medium | 🟡 Medium |
| 6. Optimize usePageView | 0.05s | Low | 🟢 Low |
| 7. Apply Migration 176 | 1-3s | Low | 🔴 High |
| 8. Keyset Pagination | 0.5-2s* | Medium | 🔴 High |
| 9. RLS Alternative | 2-5s | High | 🟡 Medium |

*Impact increases as posts table grows

**Total potential improvement:** 5-13 seconds faster page load

---

## Quick Win Implementation Order

1. **Step 2** (5 min) - Visibility filter
2. **Step 7** (5 min) - Apply migration
3. **Step 1** (30 min) - Optimize query
4. **Step 3** (15 min) - Fix dependencies
5. **Step 5** (30 min) - Lazy load locations

**Total: ~1.5 hours for 3-6s improvement**

---

## H. Client-Side Caching (React Query / SWR)

### Current Implementation

**Problem:** No client-side caching. Every navigation back to feed triggers a new fetch, even if data is fresh.

### React Query Implementation

**Install:**
```bash
npm install @tanstack/react-query
```

**Setup Provider** (`src/app/providers.tsx` or root layout):
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Updated FeedListClient with React Query:**
```typescript
'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';

export default function FeedListClient() {
  const { user } = useAuth();
  
  // Infinite query for pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['feed', 'posts'],
    queryFn: async ({ pageParam = null }) => {
      const url = new URL('/api/feed', window.location.origin);
      url.searchParams.set('limit', '20');
      if (pageParam) {
        url.searchParams.set('cursor', pageParam);
      }
      
      const response = await fetch(url.toString(), {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch feed');
      }
      
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 60 * 1000, // Cache for 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const posts = data?.pages.flatMap(page => page.posts) || [];
  
  // ... rest of component
}
```

**Benefits:**
- Automatic caching and background refetching
- Deduplication of simultaneous requests
- Optimistic updates support
- Built-in loading/error states
- Automatic garbage collection

### SWR Alternative (Lighter Weight)

**Install:**
```bash
npm install swr
```

**Usage:**
```typescript
import useSWRInfinite from 'swr/infinite';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

export default function FeedListClient() {
  const { data, error, isLoading, size, setSize } = useSWRInfinite(
    (index) => `/api/feed?limit=20&offset=${index * 20}`,
    fetcher,
    {
      revalidateFirstPage: false,
      revalidateAll: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  const posts = data?.flatMap(page => page.posts) || [];
  const hasMore = data?.[data.length - 1]?.hasMore ?? false;
  
  // ... rest of component
}
```

**Recommendation:** Use React Query for more features, SWR for simplicity.

---

## I. Database Connection Pooling

### Supabase Connection Pooler

**Current Setup:** If using Supabase, you may be using direct connections or the pooler.

**Check your connection string:**
- Direct: `postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres`
- Pooled: `postgresql://postgres:[password]@db.[project].supabase.co:6543/postgres` (port 6543)

**Recommendation:** Use connection pooler (port 6543) for API routes that make multiple queries.

**Benefits:**
- Reduced connection overhead
- Better handling of concurrent requests
- Connection reuse across requests

**Update Supabase client creation** (`src/lib/supabaseServer.ts`):
```typescript
// For server-side API routes, use pooled connection
export function createServerClient() {
  // Use pooler URL if available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const poolerUrl = process.env.SUPABASE_POOLER_URL; // Add to .env
  
  return createClient<Database>(
    poolerUrl || supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
```

**Environment variable:**
```env
SUPABASE_POOLER_URL=https://[project].pooler.supabase.com
```

**Note:** Pooler uses transaction mode by default, which is fine for read queries. For writes, ensure transactions are properly handled.

---

## J. Performance Monitoring

### Add Timing to Feed API Route

**File:** `src/app/api/feed/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const timings: Record<string, number> = {};
  
  try {
    const response = new NextResponse();
    const cookieStore = await cookies();
    
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );

    // Time auth check
    const authStart = performance.now();
    const { data: { user } } = await supabase.auth.getUser();
    timings.auth = performance.now() - authStart;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Time main query
    const queryStart = performance.now();
    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!user) {
      query = query.eq('visibility', 'public');
    }

    const { data: posts, error } = await query;
    timings.postsQuery = performance.now() - queryStart;

    if (error) {
      throw error;
    }

    // Time accounts query
    const accountsStart = performance.now();
    const accountIds = [...new Set((posts || []).map((p: any) => p.account_id).filter(Boolean))];
    let accountsMap = new Map();
    
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, first_name, last_name, image_url')
        .in('id', accountIds);
      
      if (accounts) {
        accountsMap = new Map(accounts.map((a: any) => [a.id, a]));
      }
    }
    timings.accountsQuery = performance.now() - accountsStart;

    const totalTime = performance.now() - startTime;
    timings.total = totalTime;

    // Log in development, send to monitoring in production
    if (process.env.NODE_ENV === 'development') {
      console.log('[Feed API] Performance:', {
        ...timings,
        postsCount: posts?.length || 0,
        accountsCount: accountsMap.size,
      });
    }

    // In production, send to your monitoring service
    // await sendToMonitoring('feed_api_timing', timings);

    // Add timing headers for debugging
    response.headers.set('X-Response-Time', `${totalTime.toFixed(2)}ms`);
    response.headers.set('X-Timing-Auth', `${timings.auth.toFixed(2)}ms`);
    response.headers.set('X-Timing-Posts', `${timings.postsQuery.toFixed(2)}ms`);
    response.headers.set('X-Timing-Accounts', `${timings.accountsQuery.toFixed(2)}ms`);

    // ... rest of response logic
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error('[Feed API] Error after', `${totalTime.toFixed(2)}ms:`, error);
    throw error;
  }
}
```

### Client-Side Performance Monitoring

**Add to FeedListClient:**
```typescript
useEffect(() => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const loadTime = navigation.loadEventEnd - navigation.fetchStart;
    
    console.log('[Feed Page] Load time:', `${loadTime.toFixed(2)}ms`);
    
    // Send to analytics
    if (loadTime > 3000) {
      console.warn('[Feed Page] Slow load detected:', loadTime);
    }
  }
}, []);
```

### Supabase Query Performance Insights

**Enable in Supabase Dashboard:**
1. Go to Database → Performance
2. Enable query logging
3. Review slow queries (>100ms)
4. Check index usage

**Useful queries:**
```sql
-- Find slow queries
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%posts%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'posts'
ORDER BY idx_scan DESC;
```

---

## K. Testing Strategy

### Load Testing with k6

**Create `k6/feed-load-test.js`:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },     // Stay at 10 users
    { duration: '30s', target: 50 },    // Ramp up to 50 users
    { duration: '1m', target: 50 },     // Stay at 50 users
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],     // Less than 1% errors
  },
};

export default function () {
  const response = http.get('https://your-domain.com/api/feed?limit=20', {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
    'has posts': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.posts);
    },
  });

  sleep(1);
}
```

**Run:**
```bash
k6 run k6/feed-load-test.js
```

### Apache Bench (Simple Alternative)

```bash
# Test feed endpoint
ab -n 1000 -c 10 https://your-domain.com/api/feed?limit=20

# Test with authentication (if needed)
ab -n 1000 -c 10 -H "Cookie: your-auth-cookie" https://your-domain.com/api/feed?limit=20
```

### Chrome DevTools Testing

**Network Tab:**
1. Open DevTools → Network
2. Filter by "feed"
3. Check:
   - Response time
   - Payload size
   - Waterfall timing
   - Request/Response headers

**Performance Tab:**
1. Record performance
2. Navigate to `/feed`
3. Analyze:
   - Time to First Byte (TTFB)
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Total Blocking Time (TBT)

**Lighthouse:**
```bash
# Run Lighthouse CI
npm install -g @lhci/cli
lhci autorun --collect.url=https://your-domain.com/feed
```

### Before/After Comparison

**Create test script** (`scripts/test-feed-performance.ts`):
```typescript
async function testFeedPerformance() {
  const iterations = 10;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fetch('http://localhost:3000/api/feed?limit=20');
    const duration = performance.now() - start;
    times.push(duration);
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

  console.log('Feed Performance Test Results:');
  console.log(`  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
  console.log(`  P95: ${p95.toFixed(2)}ms`);
}

testFeedPerformance();
```

**Run before and after optimizations to measure improvement.**

---

## Updated Implementation Priority

### Phase 1: Critical Fixes (1-2 hours)
1. **Step 2** - Visibility filter (5 min)
2. **Step 7** - Apply migration 176 (5 min)
3. **Step 1** - Optimize feed query (30 min)
4. **Step 8** - Keyset pagination (45 min) ⚠️ **Do this before posts table grows**

### Phase 2: Client Optimizations (1 hour)
5. **Step 3** - Fix dependencies (15 min)
6. **Step 5** - Lazy load locations (30 min)
7. **Add React Query** - Client-side caching (15 min)

### Phase 3: Monitoring & Polish (30 min)
8. **Add performance monitoring** - Timing logs (15 min)
9. **Step 4** - Defer feed stats (20 min)
10. **Step 6** - Optimize usePageView (10 min)

### Phase 4: Advanced (Optional, 1+ hours)
11. **Step 9** - RLS pattern alternative (1 hour)
12. **Connection pooling** - If not already enabled (15 min)
13. **Load testing** - Establish baseline (30 min)

**Total Phase 1-3: ~3 hours for 5-8s improvement + monitoring**





