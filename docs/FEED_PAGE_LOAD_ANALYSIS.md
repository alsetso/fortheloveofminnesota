# Feed Page Load Analysis

Complete breakdown of everything that loads when `/feed` page is accessed.

## Server-Side Load (Initial Page Load)

### 1. Page Component (`src/app/feed/page.tsx`)
- **Route Config**: `force-dynamic`, `revalidate: 60`
- **Parallel Data Fetching**:
  - `getCitiesData()`: Fetches all cities from `cities` table
    - Selects: `id, name, slug, population, county`
    - Ordered by: `population DESC`
    - Cached via React `cache()`
  - `getCountiesData()`: Fetches all counties from `counties` table
    - Selects: `id, name, slug, population, area_sq_mi`
    - Ordered by: `name ASC`
    - Cached via React `cache()`
- **Data Processing**:
  - Filters cities/counties to only those with slugs
  - Formats population numbers with locale formatting
  - Formats area as "X sq mi"
  - Maps to component-friendly structure

### 2. Layout Component (`SimplePageLayout`)
- Renders `SimpleNav` component (see below)
- Sets up page structure with max-width container
- Conditionally renders footer (hidden on feed page)

### 3. Navigation (`SimpleNav` component)
- **Auth Check**: Uses `useAuth()` hook (client-side)
- **Account Loading** (if authenticated):
  - Calls `AccountService.getCurrentAccount()` on mount
  - Fetches account data from `/api/accounts/current` or similar
- **Notifications** (if authenticated):
  - Uses `useNotifications()` hook
  - Auto-loads when `user && account` exist
  - Fetches up to 10 notifications (read + unread)
  - Loads unread count
- **Search Component**: Renders `AppSearch` (if authenticated, not on map pages)

## Client-Side Load (After Hydration)

### 4. Feed List Client (`FeedListClient` component)

#### Immediate Loads (useEffect on mount):
1. **Page View Tracking**:
   - `usePageView({ entity_type: 'feed', entity_slug: 'feed' })`
   - POSTs to `/api/analytics/view`
   - Tracks: `{ entity_type: 'feed', entity_slug: 'feed' }`

2. **Account Data** (if user exists):
   - `AccountService.getCurrentAccount()`
   - Fetches account details for authenticated users
   - Used by sidebar components

3. **Feed Posts**:
   - `fetchPosts(true)` - resets offset to 0
   - GET `/api/feed?limit=20&offset=0`
   - **API Processing**:
     - Validates auth session
     - Queries `posts` table with RLS
     - Orders by `created_at DESC`
     - Limits to 20 posts
     - Fetches associated `accounts` data (id, first_name, last_name, image_url)
     - Enriches posts with account data
     - Transforms map data from structured columns to legacy format
   - Sets `posts` state
   - Sets `hasMore` based on returned count
   - Sets `isLoading: false`

### 5. Left Sidebar Components

#### AccountViewsCard
- **Conditional Render**: Only if `user && account`
- **Data**: Uses account prop (already loaded)
- **No additional API calls**

#### PagesCard
- **Static Component**: No data fetching
- **Links**: Premium, Advertise

#### NavigationCard
- **Static Component**: No data fetching
- **Modal**: AboutMnUDAModal (lazy loaded on click)

### 6. Main Feed Content

#### MnudaHeroCard
- **Static Component**: No data fetching
- **State**: Dismissible (local state only)

#### PostCreationCard
- **Conditional Render**: Only if `user` exists
- **Account Loading** (if user exists):
  - `AccountService.getCurrentAccount()` on mount
  - Used for post creation context
- **No initial API calls** (modals load on interaction)

#### FeedPost Components (for each post)
- **Rendered**: One per post in `posts` array
- **Data**: All data provided via props
- **No additional API calls on mount**
- **Lazy Loading**:
  - Images/videos load on render
  - Map data renders if present
- **View Tracking**: Individual post views tracked on click/navigation

### 7. Right Sidebar Components

#### FeedStatsCard
- **Immediate Load** (useEffect on mount):
  - GET `/api/analytics/feed-stats?hours=24`
  - **API Processing**:
    - Calls Supabase RPC: `get_feed_stats(p_hours: 24)`
    - Returns: `total_loads`, `unique_visitors`, `accounts_active`
    - Defaults to 0 if no data
  - Sets loading state, then displays stats
  - **Toggle**: Can switch between 24h/168h (refetches on change)

#### CitiesAndCountiesSidebar
- **Data**: Uses cities/counties props (already loaded server-side)
- **State**: Shows 5 items initially, expandable
- **No additional API calls**

#### CompactFooter
- **Static Component**: No data fetching

## API Endpoints Called

### On Initial Load:
1. **GET `/api/feed?limit=20&offset=0`**
   - Fetches posts with accounts
   - RLS enforces visibility rules
   - Returns enriched post data

2. **POST `/api/analytics/view`**
   - Tracks feed page view
   - Payload: `{ entity_type: 'feed', entity_slug: 'feed' }`

3. **GET `/api/analytics/feed-stats?hours=24`**
   - Fetches feed statistics
   - Returns visitor/load/account metrics

### Conditional (if authenticated):
4. **GET `/api/accounts/current`** (or similar)
   - Called by `AccountService.getCurrentAccount()`
   - Fetches user's account data
   - Used by: SimpleNav, FeedListClient, PostCreationCard

5. **GET `/api/notifications`** (via `useNotifications` hook)
   - Fetches notifications if `user && account`
   - Limit: 10
   - Includes read/unread status

## Database Queries

### Server-Side:
1. **Cities Query**:
   ```sql
   SELECT id, name, slug, population, county 
   FROM cities 
   ORDER BY population DESC
   ```

2. **Counties Query**:
   ```sql
   SELECT id, name, slug, population, area_sq_mi 
   FROM counties 
   ORDER BY name ASC
   ```

### Client-Side (via API):
3. **Posts Query** (via `/api/feed`):
   ```sql
   SELECT * FROM posts 
   WHERE [RLS filters apply]
   ORDER BY created_at DESC 
   LIMIT 20 OFFSET 0
   ```

4. **Accounts Query** (via `/api/feed`):
   ```sql
   SELECT id, first_name, last_name, image_url 
   FROM accounts 
   WHERE id IN ([post account_ids])
   ```

5. **Feed Stats RPC**:
   ```sql
   SELECT * FROM get_feed_stats(p_hours := 24)
   ```

6. **Page View Insert** (via `/api/analytics/view`):
   ```sql
   INSERT INTO page_views (entity_type, entity_slug, ...)
   ```

7. **Account Query** (if authenticated):
   ```sql
   SELECT * FROM accounts WHERE user_id = [current_user_id]
   ```

8. **Notifications Query** (if authenticated):
   ```sql
   SELECT * FROM notifications 
   WHERE account_id = [current_account_id]
   ORDER BY created_at DESC 
   LIMIT 10
   ```

## Load Sequence Timeline

### T=0ms (Server Render):
- Fetch cities & counties in parallel
- Render page shell with data

### T=0ms (Client Hydration):
- Auth context initializes (checks session)
- `usePageView` hook fires (async, non-blocking)
- `FeedListClient` mounts

### T=0-50ms (Client Effects):
- `fetchPosts(true)` starts
- `FeedStatsCard` starts fetching stats
- If authenticated: `AccountService.getCurrentAccount()` starts
- If authenticated: `useNotifications` starts loading

### T=50-200ms (API Responses):
- Feed posts response received → state updated → posts render
- Feed stats response received → stats display
- Account data received → sidebar components update
- Notifications received → nav badge updates

### T=200ms+ (Lazy Loading):
- Post images/videos load as they enter viewport
- Map screenshots load if present
- Profile images load

## Performance Considerations

### Optimizations:
- Cities/counties cached via React `cache()`
- Parallel server-side data fetching
- Feed posts fetched immediately (don't wait for auth)
- Page view tracking is async/non-blocking
- Images use Next.js Image optimization
- Conditional rendering reduces unnecessary loads

### Potential Bottlenecks:
- **Feed API**: Single query for posts + accounts (could be optimized with joins)
- **Account Loading**: Multiple components may fetch account independently
- **Notifications**: Loads even if user doesn't open dropdown
- **Feed Stats**: Loads on every page load (could cache)

### Recommendations:
1. Consider caching feed stats response (60s TTL)
2. Consolidate account fetching (single source of truth)
3. Lazy load notifications (only when dropdown opens)
4. Optimize posts query with proper joins
5. Implement pagination cursor instead of offset
6. Add loading skeletons for better perceived performance





