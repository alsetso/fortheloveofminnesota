# API Cleanup Analysis

**Primary Pages:** `/live`, `/` (redirects to `/live`), `/profile/[slug]`, `/map/[id]`

## APIs REQUIRED (Keep)

### Maps
- `GET /api/maps` - List maps (used by profile page)
- `GET /api/maps/[id]` - Get single map (used by map/[id] page)
- `PUT /api/maps/[id]` - Update map (used by MapIdSettingsModal)
- `GET /api/maps/[id]/stats` - Map statistics (used by map/[id] page)
- `GET /api/maps/stats` - Bulk map statistics (used by profile page)
- Note: `POST /api/maps` (create map) is NOT needed - profile page links to /maps/new which is not a primary page
- `GET /api/maps/[id]/pins` - List pins (used by MapIDBox)
- `POST /api/maps/[id]/pins` - Create pin (used by MapIDBox)
- `GET /api/maps/[id]/pins/[pinId]` - Get pin (used by MapEntitySlideUp)
- `PUT /api/maps/[id]/pins/[pinId]` - Update pin (used by MapEntitySlideUp)
- `DELETE /api/maps/[id]/pins/[pinId]` - Delete pin (used by MapEntitySlideUp)
- `GET /api/maps/[id]/areas` - List areas (used by MapIDBox)
- `POST /api/maps/[id]/areas` - Create area (used by MapAreaDrawModal)
- `GET /api/maps/[id]/areas/[areaId]` - Get area (used by MapEntitySlideUp)
- `PUT /api/maps/[id]/areas/[areaId]` - Update area (used by MapEntitySlideUp)
- `DELETE /api/maps/[id]/areas/[areaId]` - Delete area (used by MapEntitySlideUp)

### Civic (Boundaries)
- `GET /api/civic/county-boundaries` - Used by LiveMap
- `GET /api/civic/ctu-boundaries` - Used by LiveMap
- `GET /api/civic/state-boundary` - Used by LiveMap
- `GET /api/civic/congressional-districts` - Used by LiveMap

### Analytics
- `POST /api/analytics/view` - Used by PageViewTracker (used on profile and map pages)
- `POST /api/analytics/special-map-view` - Used by SpecialMapViewTracker on /live
- `POST /api/analytics/map-view` - Used by map/[id] page
- `POST /api/analytics/pin-view` - Used by ProfileMap
- `GET /api/analytics/pin-stats` - Used by ProfileMap

### Billing
- `POST /api/billing/checkout` - Used by ProfileCollectionsList

### Accounts (Auth-related)
- `POST /api/accounts/onboard` - Likely needed for user onboarding
- `GET /api/accounts/username/check` - Likely needed for username validation

### Stripe Webhook
- `POST /api/stripe/webhook` - Required for payment processing

---

## APIs TO REMOVE

### News (All)
- `GET /api/news`
- `GET /api/news/all`
- `GET /api/news/latest`
- `GET /api/news/[id]`
- `GET /api/news/by-date`
- `GET /api/news/dates-with-news`
- `POST /api/news/generate`
- `GET /api/news/cron`

### Feed
- `GET /api/feed`
- `POST /api/feed`
- `GET /api/feed/[id]`

### Articles/Comments
- `GET /api/article/[id]/comments`
- `POST /api/article/[id]/comments`

### Atlas
- `GET /api/atlas/types`
- `GET /api/atlas/[table]/entities`
- `GET /api/atlas/[table]/[id]`

### Categories
- `GET /api/categories`
- `GET /api/categories/[id]`
- `GET /api/categories/search`

### Points of Interest
- `GET /api/points-of-interest`

### Location Services
- `POST /api/location-searches`
- `POST /api/address`
- `GET /api/geocode/autocomplete`

### Intelligence
- `POST /api/intelligence/chat`

### Contact
- `POST /api/contact`

### Mention Icons
- `GET /api/mention-icons`

### Skip Trace / Proxy
- `POST /api/skip-trace/store`
- `POST /api/proxy/skip-trace`
- `POST /api/proxy/zillow`

### Civic (Unused)
- `GET /api/civic/buildings` - Not used by primary pages
- `GET /api/civic/events` - Not used by primary pages

### Analytics (Unused)
- `GET /api/analytics/visitors`
- `GET /api/analytics/homepage-stats`
- `GET /api/analytics/live-visitors`
- `GET /api/analytics/atlas-map-stats`
- `GET /api/analytics/special-map-stats`
- `GET /api/analytics/my-pins`
- `GET /api/analytics/my-entities`
- `GET /api/analytics/feed-stats`

### Billing (Unused)
- `GET /api/billing/data` - Not used by primary pages

### Accounts (Unused)
- `GET /api/accounts` - Direct DB queries used instead
- `POST /api/accounts` - Direct DB queries used instead

### Test Routes
- `POST /api/test-payments/create-intent`

### Admin (All)
- All `/api/admin/*` routes - Not used by primary pages

### FAQs
- All `/api/faqs/*` routes - Not used by primary pages

---

## DECISION POINT

- `POST /api/maps` - Profile page has "Create Map" button that navigates to `/maps/new` (not a primary page). If you want map creation on profile page itself, keep this. Otherwise remove.

---

---

## AFFECTED PAGE ROUTES TO DELETE

### News Pages (DELETE)
- `/news/[id]` - News article page (uses `/api/news/[id]`)
- Note: No dedicated `/news` listing page found, but components may use news APIs

### Feed Pages (DELETE)
- No dedicated `/feed` page found, but feed components exist in features
- Feed functionality appears to be integrated into homepage

### Atlas Pages (DELETE)
- `/map/atlas/[table]` - Atlas map page (uses `/api/atlas/types`, `/api/atlas/[table]/entities`)
- `/explore/atlas/[table_name]/[id]` - Atlas entity detail (uses `/api/atlas/[table]/[id]`)

### Calendar/Events Pages (KEEP - uses direct DB)
- `/calendar/events` - Events page (uses EventService with direct DB queries, not `/api/civic/events`)

### Contact Page (KEEP - static page)
- `/contact` - Contact page (static, doesn't use `/api/contact` - API appears unused)

### Search Page (KEEP - uses Mapbox directly)
- `/search` - Uses Mapbox API directly, not `/api/geocode/autocomplete`
- **KEEP** - No API dependency to remove

### Special Map Pages (DELETE - not primary pages)
- `/map/skip-tracing` - Skip tracing map (may use `/api/skip-trace/store`, `/api/proxy/skip-trace`)
- `/map/realestate` - Real estate map (may use `/api/proxy/zillow`)
- `/map/fraud` - Fraud map
- `/map/mention` - Mention map (uses mention icons potentially)

### Explore Pages (VERIFY)
- `/explore/cities` - May use categories API
- `/explore/city/[slug]` - May use categories API
- `/explore/counties` - May use categories API
- `/explore/county/[slug]` - May use categories API
- **VERIFY** - Check if these use `/api/categories` or direct DB queries

### Admin Pages (DELETE - not primary pages)
- `/admin/*` - All admin pages (use admin APIs)

### Other Pages (KEEP - no API dependencies)
- `/download` - Static page
- `/privacy` - Static page
- `/terms` - Static page
- `/login` - Auth page (uses Supabase directly)
- `/signup` - Auth page (uses Supabase directly)
- `/contribute` - Static page
- `/gov/*` - Government pages (may use civic APIs, verify)

---

## Summary

**Keep:** ~26 API routes (including POST /api/maps if map creation needed)
**Remove:** ~60+ API routes

**Page Routes to DELETE:**
- `/news/[id]` (1 route) - Uses `/api/news/[id]`
- `/map/atlas/[table]` (1 route pattern) - Uses `/api/atlas/types`, `/api/atlas/[table]/entities`
- `/explore/atlas/[table_name]/[id]` (1 route pattern) - Uses `/api/atlas/[table]/[id]`
- `/map/skip-tracing` (1 route) - May use skip-trace APIs
- `/map/realestate` (1 route) - May use zillow proxy
- `/map/fraud` (1 route) - Special map page
- `/map/mention` (1 route) - Special map page
- `/admin/*` (all admin routes) - Uses admin APIs

**Page Routes to VERIFY:**
- `/explore/cities`, `/explore/city/[slug]`, `/explore/counties`, `/explore/county/[slug]` - Check if they use categories API
- `/gov/*` - Check if they use civic APIs beyond boundaries

**Categories to remove entirely:**
- News (8 routes) → `/news/[id]` page
- Feed (3 routes) → No dedicated page, but components
- Atlas (3 routes) → `/map/atlas/[table]`, `/explore/atlas/*` pages
- Categories (3 routes) → Verify explore pages
- Points of Interest (1 route) → No page found
- Location Services (3 routes) → No page uses these
- Intelligence (1 route) → No page found
- Contact (1 route) → API appears unused (contact page is static)
- Mention Icons (1 route) → `/map/mention` page
- Skip Trace/Proxy (3 routes) → `/map/skip-tracing`, `/map/realestate` pages
- Admin (all routes) → `/admin/*` pages
- FAQs (all routes) → No page found
- Test routes (1 route) → No page

**Partial removals:**
- Analytics: Keep 4, remove 8
- Civic: Keep 4 (boundaries), remove 2 (buildings, events) → Events page uses direct DB, not API
- Billing: Keep 1, remove 1
- Accounts: Keep 2, remove 2
