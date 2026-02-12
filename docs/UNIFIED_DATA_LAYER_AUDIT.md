# Unified Data Layer Audit & Consolidation Plan

**Date:** 2025-02-04  
**Purpose:** Complete table-by-table audit for transitioning to Unified Data Layer  
**Goal:** Identify current usage, overlaps, and create clean migration path

---

## Table-by-Table Analysis

### 1. `public.accounts`

**What is this table for?**
- Core user account data (linked to `auth.users`)
- Stores: `first_name`, `last_name`, `image_url`, `role`, `stripe_customer_id`
- One account per user (1:1 with `auth.users`)

**Who sees this data?**
- **Public users:** Limited fields (`id`, `first_name`, `last_name`, `username`, `image_url`) - only for accounts with public content
- **Logged-in users:** Can see all accounts (full read access)
- **Own account:** Full CRUD access
- **Admins:** Full access to all accounts

**Where is it rendered today?**
- **Feed:** Post author info (sidebar, post cards)
- **Profile pages:** `/[username]` - account details
- **Map pins:** Pin creator attribution
- **Search results:** User search results
- **Settings:** Account management pages
- **Admin:** Account management interface

**Current usage patterns:**
- ✅ Fetched via `/api/accounts/current` for current user
- ✅ Joined in posts/pins queries: `accounts(id, first_name, last_name, image_url)`
- ✅ Separate queries for account lists (search, admin)
- ⚠️ **Issue:** Multiple separate queries instead of aggregate endpoints

**Consolidation plan:**
- Create `accountQueries.list()` for account lists
- Create `accountQueries.byId(id)` for single account
- Aggregate account data in post/pin queries (already doing this)
- Use React Query cache for account lookups

---

### 2. `public.profiles`

**What is this table for?**
- User profiles (operational data)
- Stores: `username`, `profile_image`, `profile_type`, `onboarding_data`
- Multiple profiles per account (1:many with `accounts`)

**Who sees this data?**
- **Public users:** `username`, `profile_image` (via profile pages)
- **Logged-in users:** Can see all profiles
- **Own profiles:** Full CRUD access
- **Admins:** Full access

**Where is it rendered today?**
- **Profile pages:** `/[username]` - primary profile display
- **Onboarding:** Profile creation/editing
- **Settings:** Profile management

**Current usage patterns:**
- ✅ Fetched via username lookup: `/api/accounts/username/[username]`
- ✅ Used for profile page rendering
- ⚠️ **Issue:** Separate from accounts table, causes confusion

**Consolidation plan:**
- Merge profile queries into account queries
- Use `accountQueries.byUsername(username)` that includes profile data
- Single source of truth for user identity

---

### 3. `public.map` (custom maps)

**What is this table for?**
- User-created custom maps
- Stores: `name`, `slug`, `description`, `visibility`, `settings`, `boundary`, `account_id`
- Maps can be public, private, or shared

**Who sees this data?**
- **Public users:** Public maps only
- **Logged-in users:** Public maps + own maps + maps they're members of
- **Map owners:** Full CRUD access
- **Map members:** Read access (role-based: manager, editor)
- **Admins:** Full access

**Where is it rendered today?**
- **Maps list:** `/maps` - grid/list view
- **Map detail:** `/map/[id]` - full map view with pins/areas
- **Live map:** `/live` - special "live" map
- **Profile pages:** User's maps section
- **Search:** Map search results

**Current usage patterns:**
- ✅ `/api/maps` - list endpoint (filters: `community`, `account_id`, `view`)
- ✅ `/api/maps/[id]` - single map
- ✅ `/api/maps/[id]/data` - **aggregate endpoint** (map + stats + pins + areas + members) ⭐
- ✅ `/api/maps/stats` - bulk stats for multiple maps
- ⚠️ **Issue:** Some pages still fetch map + pins separately (should use `/data` endpoint)

**Consolidation plan:**
- ✅ **Already consolidated** - `/api/maps/[id]/data` is perfect pattern
- Migrate all map pages to use `mapQueries.byId(id)` → uses `/data` endpoint
- Create `mapQueries.list(filters)` for map lists
- Create `mapQueries.feed()` for infinite scroll

---

### 4. `public.map_pins`

**What is this table for?**
- Pins on custom maps (user-created content)
- Stores: `lat`, `lng`, `description`, `image_url`, `video_url`, `account_id`, `map_id`, `mention_type_id`, `visibility`
- Replaced old `mentions` table

**Who sees this data?**
- **Public users:** Public pins only
- **Logged-in users:** Public pins + own pins + pins on maps they can access
- **Pin creators:** Full CRUD access
- **Map owners/managers:** Can edit pins on their maps
- **Admins:** Full access

**Where is it rendered today?**
- **Map pages:** `/map/[id]` - pins displayed on map
- **Live map:** `/live` - all public pins
- **Pin detail:** Modal/popup when clicking pin
- **Feed:** Pin activity feed
- **Search:** Pin search results

**Current usage patterns:**
- ✅ `/api/maps/[id]/pins` - pins for a map
- ✅ `/api/maps/live/pins/[pinId]` - single pin detail
- ✅ `/api/mentions/nearby` - nearby pins (radius search)
- ✅ Included in `/api/maps/[id]/data` aggregate ⭐
- ⚠️ **Issue:** Some components fetch pins separately instead of using aggregate

**Consolidation plan:**
- Use `mapQueries.byId(id)` which includes pins (via `/data` endpoint)
- Create `pinQueries.byId(id)` for single pin detail
- Create `pinQueries.nearby(lat, lng, radius)` for nearby search
- Remove separate pin fetches where map data is already loaded

---

### 5. `public.map_areas`

**What is this table for?**
- User-drawn areas/polygons on maps
- Stores: `name`, `description`, `geometry` (GeoJSON), `map_id`, `account_id`, `visibility`

**Who sees this data?**
- **Public users:** Public areas only
- **Logged-in users:** Public areas + own areas + areas on accessible maps
- **Area creators:** Full CRUD access
- **Map owners/managers:** Can edit areas on their maps
- **Admins:** Full access

**Where is it rendered today?**
- **Map pages:** `/map/[id]` - areas displayed as polygons
- **Area detail:** Modal when clicking area
- **Settings:** Area management

**Current usage patterns:**
- ✅ `/api/maps/[id]/areas` - areas for a map
- ✅ Included in `/api/maps/[id]/data` aggregate ⭐
- ⚠️ **Issue:** Rarely used, but follows same pattern as pins

**Consolidation plan:**
- Use `mapQueries.byId(id)` which includes areas (via `/data` endpoint)
- Create `areaQueries.byId(id)` for single area detail
- Keep separate endpoint only if needed for editing

---

### 6. `public.map_members`

**What is this table for?**
- Map membership (who can access/edit maps)
- Stores: `map_id`, `account_id`, `role` (owner, manager, editor)
- Controls access to private/shared maps

**Who sees this data?**
- **Map owners:** See all members
- **Map managers:** See all members
- **Map members:** See other members (if map allows)
- **Public users:** Cannot see members (private data)

**Where is it rendered today?**
- **Map settings:** Member management UI
- **Map detail:** Member list sidebar
- **Admin:** Map membership management

**Current usage patterns:**
- ✅ `/api/maps/[id]/members` - members for a map
- ✅ Included in `/api/maps/[id]/data` aggregate ⭐
- ⚠️ **Issue:** Sometimes fetched separately when already in aggregate

**Consolidation plan:**
- Use `mapQueries.byId(id)` which includes members (via `/data` endpoint)
- Only fetch separately for member management UI (when editing)

---

### 7. `public.posts`

**What is this table for?**
- Feed posts (social content)
- Stores: `title`, `content`, `images`, `account_id`, `map_id`, `mention_type_id`, `visibility`, `map_data`
- Can be linked to maps or standalone

**Who sees this data?**
- **Public users:** Public posts only
- **Logged-in users:** Public posts + own posts
- **Post creators:** Full CRUD access
- **Admins:** Full access

**Where is it rendered today?**
- **Feed:** `/feed` - main feed page
- **Homepage:** `/` - feed content
- **Profile pages:** User's posts
- **Map pages:** Posts linked to map
- **Post detail:** `/post/[id]` - full post view
- **Search:** Post search results

**Current usage patterns:**
- ✅ `/api/feed` - feed posts (paginated)
- ✅ `/api/posts` - all posts (with filters)
- ✅ `/api/posts/[id]` - single post
- ⚠️ **Issue:** Separate account queries after fetching posts (should join)
- ⚠️ **Issue:** No aggregate endpoint for post + author + map data

**Consolidation plan:**
- Create `/api/posts/[id]/data` aggregate endpoint (post + account + map + stats)
- Create `postQueries.feed()` for feed (includes account data in join)
- Create `postQueries.byId(id)` for single post
- Create `postQueries.byAccount(accountId)` for profile posts
- Join account data in query (already doing this, but optimize)

---

### 8. `public.collections`

**What is this table for?**
- Collections of pins (user-organized groups)
- Stores: `title`, `emoji`, `description`, `account_id`, `visibility`
- Users can organize pins into collections

**Who sees this data?**
- **Public users:** Public collections only
- **Logged-in users:** Public collections + own collections
- **Collection creators:** Full CRUD access
- **Admins:** Full access

**Where is it rendered today?**
- **Profile pages:** User's collections
- **Collection detail:** Collection view with pins
- **Settings:** Collection management
- **Pin detail:** Collection selector

**Current usage patterns:**
- ✅ `/api/collections` - list collections
- ✅ `/api/collections/[id]` - single collection
- ⚠️ **Issue:** Rarely used, but follows standard pattern

**Consolidation plan:**
- Create `collectionQueries.list(filters)`
- Create `collectionQueries.byId(id)`
- Create `collectionQueries.byAccount(accountId)` for profile collections

---

### 9. `public.mention_types`

**What is this table for?**
- Pin/post type categories (emoji + name)
- Stores: `name`, `emoji`, `slug`, `is_active`
- Reference data (not user-created)

**Who sees this data?**
- **Everyone:** All active mention types (public reference data)
- **Admins:** Can create/edit types

**Where is it rendered today?**
- **Map filters:** Mention type filter sidebar
- **Pin creation:** Type selector
- **Post creation:** Type selector
- **Feed filters:** Type filter

**Current usage patterns:**
- ✅ Fetched via Supabase: `.from('mention_types').select('*').eq('is_active', true)`
- ✅ Cached client-side (rarely changes)
- ⚠️ **Issue:** Fetched multiple times, should be cached globally

**Consolidation plan:**
- Create `mentionTypeQueries.all()` - cached for 1 hour (rarely changes)
- Use React Query with long staleTime
- Single fetch on app load, shared across components

---

### 10. `atlas.cities` & `atlas.counties`

**What is this table for?**
- Geographic reference data (Minnesota cities/counties)
- Stores: `name`, `slug`, `population`, `lat`, `lng`
- Static reference data (admin-managed)

**Who sees this data?**
- **Everyone:** Public reference data
- **Admins:** Can edit (rare)

**Where is it rendered today?**
- **Feed sidebar:** Cities/counties list
- **Search:** Location search
- **Filters:** Location filters
- **Profile:** Location selection

**Current usage patterns:**
- ✅ Fetched server-side: `/api/civic/cities` or direct Supabase query
- ✅ Cached client-side (sessionStorage)
- ⚠️ **Issue:** Multiple fetch patterns, should be unified

**Consolidation plan:**
- Create `atlasQueries.cities()` - cached for 1 day (rarely changes)
- Create `atlasQueries.counties()` - cached for 1 day
- Use React Query with very long staleTime
- Single fetch, shared across app

---

### 11. `atlas.*` (POI tables: parks, schools, neighborhoods, etc.)

**What is this table for?**
- Points of Interest (parks, schools, hospitals, etc.)
- 13+ tables: `neighborhoods`, `schools`, `parks`, `lakes`, `watertowers`, `cemeteries`, `golf_courses`, `hospitals`, `airports`, `churches`, `municipals`, `roads`, `radio_and_news`
- Static reference data (admin-managed)

**Who sees this data?**
- **Everyone:** Public reference data
- **Admins:** Can create/edit

**Where is it rendered today?**
- **Map overlays:** POI markers on maps
- **Search:** POI search results
- **Atlas pages:** POI detail pages (future)

**Current usage patterns:**
- ✅ Fetched via `atlas.atlas_entities` view (unified view)
- ✅ Filtered by `table_name` and `city_id`
- ⚠️ **Issue:** Not heavily used yet, but foundation is there

**Consolidation plan:**
- Create `atlasQueries.entities(filters)` - uses unified view
- Create `atlasQueries.byType(type, cityId)` - filter by POI type
- Create `atlasQueries.byId(id, type)` - single POI detail
- Use React Query with long cache (rarely changes)

---

### 12. `civic.orgs`, `civic.people`, `civic.roles`

**What is this table for?**
- Government directory (organizations, people, roles)
- `orgs`: Government organizations
- `people`: Government officials/people
- `roles`: Links people to organizations with titles/dates

**Who sees this data?**
- **Everyone:** Public government data
- **Authenticated users:** Can edit (community edits)
- **Admins:** Full CRUD access

**Where is it rendered today?**
- **Gov pages:** `/gov` - tables view
- **Org detail:** `/gov/org/[slug]` - organization page
- **Person detail:** `/gov/person/[slug]` - person page
- **Checkbook:** Financial data pages

**Current usage patterns:**
- ✅ `/api/civic/orgs` - list organizations
- ✅ `/api/civic/people` - list people
- ✅ `/api/civic/roles` - list roles
- ✅ Cached client-side (sessionStorage, 5-10 min)
- ⚠️ **Issue:** Three separate endpoints, should aggregate

**Consolidation plan:**
- Create `/api/civic/data` aggregate endpoint (orgs + people + roles)
- Create `civicQueries.orgs()`
- Create `civicQueries.people()`
- Create `civicQueries.roles()`
- Create `civicQueries.orgBySlug(slug)` - includes people + roles
- Create `civicQueries.personBySlug(slug)` - includes roles + orgs

---

### 13. `checkbook.*` (budgets, payments, payroll, contracts)

**What is this table for?**
- State financial data (budgets, payments, payroll, contracts)
- Four tables: `budgets`, `payments`, `payroll`, `contracts`
- Public financial transparency data

**Who sees this data?**
- **Everyone:** Public financial data
- **Admins:** Can import/update data

**Where is it rendered today?**
- **Checkbook pages:** `/gov/checkbook/*` - financial tables
- **Org detail:** Financial data on org pages

**Current usage patterns:**
- ✅ `/api/civic/checkbook/budget` - budget data
- ✅ `/api/civic/checkbook/payments` - payments
- ✅ `/api/civic/checkbook/payroll` - payroll
- ✅ `/api/civic/checkbook/contracts` - contracts
- ⚠️ **Issue:** Large datasets, needs pagination/filtering

**Consolidation plan:**
- Create `checkbookQueries.budgets(filters)` - with pagination
- Create `checkbookQueries.payments(filters)`
- Create `checkbookQueries.payroll(filters)`
- Create `checkbookQueries.contracts(filters)`
- Use React Query with moderate cache (data updates periodically)

---

### 14. `news.generated` & `news.prompt`

**What is this table for?**
- AI-generated news articles
- `prompt`: News generation prompts
- `generated`: Generated articles

**Who sees this data?**
- **Everyone:** Published articles
- **Admins:** Can generate/edit articles

**Where is it rendered today?**
- **News page:** `/news` - article list
- **News detail:** `/news/[id]` - article view
- **News generation:** `/news/generate` - admin tool

**Current usage patterns:**
- ✅ `/api/news` - list articles
- ✅ `/api/news/[id]` - single article
- ✅ `/api/news/generate` - generate article (admin)

**Consolidation plan:**
- Create `newsQueries.list(filters)`
- Create `newsQueries.byId(id)`
- Create `newsQueries.latest()` - latest articles
- Use React Query with moderate cache

---

### 15. `analytics.events` & `analytics.url_visits`

**What is this table for?**
- Analytics/telemetry data
- `events`: Custom events (pin views, map views, etc.)
- `url_visits`: Page view tracking

**Who sees this data?**
- **Content creators:** Their own analytics
- **Map owners:** Their map analytics
- **Admins:** All analytics

**Where is it rendered today?**
- **Analytics page:** `/analytics` - user analytics
- **Map settings:** Map-specific analytics
- **Admin:** System-wide analytics

**Current usage patterns:**
- ✅ `/api/analytics/view` - track page view
- ✅ `/api/analytics/map-view` - track map view
- ✅ `/api/analytics/pin-view` - track pin view
- ✅ `/api/analytics/account` - account analytics
- ⚠️ **Issue:** Write-heavy, read-light (analytics queries)

**Consolidation plan:**
- Keep write endpoints as-is (POST for tracking)
- Create `analyticsQueries.account(accountId, filters)` - read analytics
- Create `analyticsQueries.map(mapId, filters)` - map analytics
- Use React Query with short cache (real-time data)

---

### 16. `billing.plans`, `billing.features`, `billing.plan_features`

**What is this table for?**
- Billing/subscription system
- `plans`: Subscription plans
- `features`: Available features
- `plan_features`: Plan-to-feature mappings

**Who sees this data?**
- **Everyone:** Public plan information
- **Logged-in users:** Their plan + features
- **Admins:** Full CRUD access

**Where is it rendered today?**
- **Plans page:** `/plans` - plan comparison
- **Billing page:** `/billing` - user billing
- **Settings:** Plan management

**Current usage patterns:**
- ✅ `/api/billing/plans` - list plans
- ✅ `/api/billing/user-features` - user's features
- ✅ Server-side: `getAuthAndBilling()` - includes billing data
- ⚠️ **Issue:** Billing data fetched server-side, then hydrated client-side

**Consolidation plan:**
- Create `billingQueries.plans()` - public plans
- Create `billingQueries.userFeatures()` - user's features (authenticated)
- Use React Query with moderate cache
- Keep server-side initial fetch for SSR

---

### 17. `public.subscriptions`

**What is this table for?**
- User subscriptions (Stripe integration)
- Stores: `account_id`, `stripe_subscription_id`, `plan_id`, `status`

**Who sees this data?**
- **Own account:** Can see own subscription
- **Admins:** Can see all subscriptions

**Where is it rendered today?**
- **Billing page:** `/billing` - subscription management
- **Settings:** Subscription settings

**Current usage patterns:**
- ✅ `/api/billing/subscriptions` - list subscriptions
- ✅ Server-side: Included in billing context

**Consolidation plan:**
- Create `billingQueries.subscriptions()` - user's subscriptions
- Use React Query with moderate cache
- Keep server-side initial fetch

---

### 18. `id.verifications`

**What is this table for?**
- ID verification system (government/business verification)
- Stores: `account_id`, `status`, `document_url`, `reviewed_by`

**Who sees this data?**
- **Own account:** Can see own verification status
- **Admins:** Can review verifications

**Where is it rendered today?**
- **Settings:** `/settings/id` - verification page
- **Admin:** Verification review interface

**Current usage patterns:**
- ✅ `/api/id-verification/submissions` - user's submissions
- ✅ `/api/id-verification/[id]/review` - admin review

**Consolidation plan:**
- Create `verificationQueries.status()` - user's verification status
- Create `verificationQueries.submissions()` - user's submissions
- Use React Query with moderate cache

---

## Overlaps & Duplications

### 1. **Account + Profile Confusion**
- **Issue:** `accounts` and `profiles` tables serve similar purposes
- **Impact:** Confusion about which to query, duplicate data
- **Solution:** Always query accounts, include profile data in join
- **Migration:** Use `accountQueries.byId(id)` that includes profile

### 2. **Multiple Map Data Fetches**
- **Issue:** Some pages fetch map + pins + areas separately
- **Impact:** 3-4 API calls instead of 1
- **Solution:** Use `/api/maps/[id]/data` aggregate endpoint everywhere
- **Migration:** Replace separate fetches with `mapQueries.byId(id)`

### 3. **Post Account Joins**
- **Issue:** Posts fetched, then accounts fetched separately
- **Impact:** Extra round trip
- **Solution:** Join accounts in post query (already doing this, but optimize)
- **Migration:** Ensure all post queries include account join

### 4. **Reference Data Caching**
- **Issue:** Mention types, cities, counties fetched multiple times
- **Impact:** Unnecessary network requests
- **Solution:** Global React Query cache with long staleTime
- **Migration:** Create `mentionTypeQueries.all()`, `atlasQueries.cities()`, etc.

### 5. **Civic Data Fragmentation**
- **Issue:** Orgs, people, roles fetched separately
- **Impact:** 3 API calls for gov pages
- **Solution:** Create `/api/civic/data` aggregate endpoint
- **Migration:** Use `civicQueries.orgs()`, `civicQueries.people()`, etc.

---

## Consolidation Strategy

### Phase 1: Foundation (Week 1)
1. ✅ Install React Query
2. ✅ Create `src/lib/data/client.ts` - QueryClient setup
3. ✅ Create `src/lib/data/queries/` directory structure
4. ✅ Create query functions for 5 most-used tables:
   - `mapQueries` (maps, pins, areas, members)
   - `postQueries` (posts + accounts)
   - `accountQueries` (accounts + profiles)
   - `mentionTypeQueries` (reference data)
   - `atlasQueries` (cities, counties)

### Phase 2: Core Tables (Week 2)
1. Migrate map pages to use `mapQueries`
2. Migrate feed to use `postQueries`
3. Migrate profile pages to use `accountQueries`
4. Add React Query to 10 most-used components

### Phase 3: Reference Data (Week 3)
1. Create `atlasQueries` for all POI tables
2. Create `civicQueries` for gov data
3. Create `checkbookQueries` for financial data
4. Add long-term caching for reference data

### Phase 4: Analytics & Billing (Week 4)
1. Create `analyticsQueries` (read-only, short cache)
2. Create `billingQueries` (moderate cache)
3. Create `newsQueries`
4. Complete migration

---

## Query Function Structure

```typescript
// src/lib/data/queries/maps.ts
export const mapQueries = {
  // Single map with all related data (uses aggregate endpoint)
  byId: (id: string) => ({
    queryKey: ['map', id],
    queryFn: async () => {
      const res = await fetch(`/api/maps/${id}/data`);
      if (!res.ok) throw new Error('Failed to fetch map');
      return res.json(); // Returns: { map, stats, pins, areas, members }
    },
    staleTime: 5 * 60 * 1000, // 5 min
  }),

  // List maps (with filters)
  list: (filters?: { view?: string; search?: string; account_id?: string }) => ({
    queryKey: ['maps', 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/maps?${params}`);
      return res.json();
    },
  }),

  // Infinite scroll feed
  feed: () => ({
    queryKey: ['maps', 'feed'],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/maps?offset=${pageParam}&limit=20`);
      const data = await res.json();
      return {
        ...data,
        nextOffset: data.maps.length === 20 ? pageParam + 20 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
  }),
};
```

---

## Migration Checklist

### For Each Table:
- [ ] Create query function in `src/lib/data/queries/[table].ts`
- [ ] Identify aggregate endpoints (or create them)
- [ ] Update components to use `useQuery(queryFunction)`
- [ ] Remove manual `useEffect` + `fetch` patterns
- [ ] Remove client-side caching (sessionStorage, refs)
- [ ] Test loading states, error states, cache behavior

### Priority Order:
1. **Maps** (most complex, already has aggregate endpoint)
2. **Posts** (high traffic, needs optimization)
3. **Accounts** (used everywhere)
4. **Reference data** (mention types, cities, counties)
5. **Civic data** (gov pages)
6. **Everything else**

---

## Success Metrics

- **API calls reduced:** 80% (via caching + deduplication)
- **Page load time:** 50% faster (via aggregate endpoints)
- **Code reduction:** 70% less data fetching code
- **Consistency:** All data fetching goes through unified layer
- **Developer experience:** Simple `useQuery()` calls instead of manual fetches

---

## Notes

- **Don't break anything:** Migrate incrementally, test each table
- **Don't over-engineer:** Start simple, add complexity only if needed
- **Keep aggregate endpoints:** They're the key to performance
- **Cache aggressively:** Reference data rarely changes
- **Monitor performance:** Use React Query DevTools
