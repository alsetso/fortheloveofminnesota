# Gov System Performance Improvements

## Summary

Optimized page load speeds and data fetching across the entire gov system with client-side caching and HTTP cache headers.

## Changes Made

### 1. Client-Side Caching (sessionStorage)

#### GovPageClient.tsx
- ✅ Added 5-minute cache for government maps
- ✅ Caches both maps list and stats
- ✅ Reduces API calls on page revisits
- ✅ Cache key: `gov_maps_cache`

#### PeoplePageClient.tsx
- ✅ Added 10-minute cache for people data
- ✅ Caches people + roles combined data
- ✅ Instant load on revisits within cache window
- ✅ Cache key: `gov_people_cache`

#### GovTablesClient.tsx
- ✅ Added 5-minute cache for each tab (orgs, people, roles)
- ✅ Works with existing `loadedTabs` logic
- ✅ Persists across page refreshes
- ✅ Cache keys: `gov_tables_orgs_cache`, `gov_tables_people_cache`, `gov_tables_roles_cache`

### 2. HTTP Cache Headers

#### /api/maps Route
- ✅ Added `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` for public maps
- ✅ Only applies to public maps (not user-specific queries)
- ✅ 5-minute cache with 10-minute stale-while-revalidate

#### /api/maps/stats Route
- ✅ Added `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`
- ✅ Stats don't change frequently, safe to cache
- ✅ Reduces database load

### 3. API Response Helper Update

#### apiError.ts
- ✅ Updated `createSuccessResponse` to accept optional headers
- ✅ Allows cache headers to be set per endpoint
- ✅ Backward compatible (headers optional)

## Performance Impact

### Before
- **Gov maps**: Fetched on every page visit (2 API calls)
- **People data**: Fetched on every page visit (2 Supabase queries)
- **Table data**: Fetched on every tab switch (no persistence)
- **No HTTP caching**: Every request hits the server

### After
- **Gov maps**: Cached for 5 minutes (instant load on revisits)
- **People data**: Cached for 10 minutes (instant load on revisits)
- **Table data**: Cached for 5 minutes per tab (persists across refreshes)
- **HTTP caching**: CDN/edge caches responses for 5 minutes

### Expected Improvements

1. **First Visit**: Same speed (cache miss)
2. **Revisit within 5-10 min**: 
   - Maps: **Instant** (from sessionStorage)
   - People: **Instant** (from sessionStorage)
   - Tables: **Instant** (from sessionStorage)
3. **API Calls**: Reduced by ~70-80% for repeat visitors
4. **Server Load**: Reduced by ~70-80% for cached requests
5. **User Experience**: Faster perceived load times

## Cache Strategy

### Client-Side (sessionStorage)
- **Duration**: 5-10 minutes depending on data type
- **Scope**: Per browser session
- **Invalidation**: Time-based (automatic expiry)
- **Fallback**: Graceful degradation if cache fails

### Server-Side (HTTP Headers)
- **Duration**: 5 minutes (s-maxage=300)
- **Stale-While-Revalidate**: 10 minutes
- **Scope**: Public data only (not user-specific)
- **CDN**: Edge caches benefit from headers

## Cache Keys

- `gov_maps_cache` - Government maps list + stats
- `gov_people_cache` - People data with roles
- `gov_tables_orgs_cache` - Organizations table data
- `gov_tables_people_cache` - People table data
- `gov_tables_roles_cache` - Roles table data

## Testing Checklist

- [x] No linter errors
- [ ] Test gov page loads maps from cache on revisit
- [ ] Test people page loads from cache on revisit
- [ ] Test table tabs load from cache
- [ ] Test cache expires after timeout
- [ ] Test cache clears on manual refresh
- [ ] Test API cache headers are set correctly
- [ ] Test graceful fallback if cache fails

## Notes

- Cache durations are conservative (5-10 min) to balance freshness vs performance
- sessionStorage is used (not localStorage) so cache clears on browser close
- All caches have try/catch blocks for graceful degradation
- HTTP cache headers only apply to public data (security consideration)
- Stats are cached separately from maps for better granularity
