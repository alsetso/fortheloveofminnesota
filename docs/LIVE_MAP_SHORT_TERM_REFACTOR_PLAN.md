# Live Map: Elite Short-Term Refactor Plan

## Executive Summary

Fix the most painful issues in the live map flows with minimal disruption. Focus on performance, state management, and user experience.

---

## Frontend Changes

### 1. Consolidate Mention Fetching
**What's broken**: Multiple components fetch the same mention data, causing duplicate requests and race conditions.

**Fix**:
- Create `useMentionData(mentionId)` hook that caches fetched mentions
- Replace all direct Supabase calls with this hook
- Add request deduplication (don't fetch if already in-flight)

**Impact**: Faster loads, no duplicate requests, better error handling

---

### 2. Simplify Pin Marker State
**What's broken**: White pin → red pin logic is scattered across 5+ places with complex conditionals.

**Fix**:
- Create `usePinMarker(mapInstance, coordinates, color)` hook
- Single source of truth for pin creation/removal/color changes
- Remove all `temporaryMarkerRef` logic from components

**Impact**: Easier to maintain, fewer bugs, cleaner code

---

### 3. Replace Event Chaos with Context
**What's broken**: 10+ custom events (`mention-click`, `mention-selected-from-map`, etc.) make code hard to follow.

**Fix**:
- Create `LiveMapContext` with: `selectedMention`, `isSheetOpen`, `locationPopup`
- Replace events with context updates
- Keep URL sync but use context as source of truth

**Impact**: Easier debugging, type-safe, predictable state flow

---

### 4. Keep Create Flow Inline
**What's broken**: Clicking map → navigating to `/add` page loses map context.

**Fix**:
- Remove navigation to `/add` page
- Open `CreateMentionPopup` directly from `LocationSelectPopup`
- Pass coordinates via props/context instead of URL

**Impact**: Better UX, no context loss, faster workflow

---

### 5. Cache Reverse Geocoding
**What's broken**: Every map click triggers reverse geocoding API call, even for same location.

**Fix**:
- Create `useReverseGeocode(lat, lng)` hook with in-memory cache
- Cache results by rounded coordinates (6 decimal places = ~10cm precision)
- Reuse cached address for same location

**Impact**: Faster popup appearance, fewer API calls, lower costs

---

### 6. Debounce URL Updates
**What's broken**: Rapid mention clicks cause multiple URL updates and re-renders.

**Fix**:
- Debounce URL updates in `useLiveUrlState` (300ms)
- Batch multiple parameter changes into single update
- Only trigger effects after debounce completes

**Impact**: Smoother interactions, fewer re-renders, better performance

---

## Backend Changes

### 1. Add Mention Fetching Endpoint
**What's broken**: Components make direct Supabase queries with complex joins.

**Fix**:
- Create `/api/mentions/[id]` endpoint
- Returns full mention with all relations (account, collection, mention_type)
- Add caching headers (5min cache for public mentions)

**Impact**: Consistent data shape, easier to cache, better error handling

---

### 2. Optimize Nearby Mentions Query
**What's broken**: `MentionService.getMentions({ bbox })` fetches all mentions then filters client-side.

**Fix**:
- Add PostGIS spatial query: `ST_DWithin(geom, point, radius)`
- Add database index on `(lat, lng)` or use PostGIS geometry column
- Return only mentions within radius, sorted by distance

**Impact**: 10-100x faster queries, scales to millions of mentions

---

### 3. Add Mention Fetching Cache
**What's broken**: Same mention fetched multiple times in short period.

**Fix**:
- Add Redis cache layer (or in-memory for single server)
- Cache key: `mention:{id}` with 5min TTL
- Invalidate on mention update/delete

**Impact**: Faster response times, less database load

---

### 4. Batch Nearby Mentions Endpoint
**What's broken**: Sheet opens → fetches nearby mentions → separate request for selected mention.

**Fix**:
- Create `/api/mentions/nearby?lat=X&lng=Y&radius=0.5&include=Z`
- Returns nearby mentions + optionally includes specific mention by ID
- Single request instead of two

**Impact**: Faster sheet load, fewer requests, better mobile experience

---

## Implementation Order (Priority)

### Week 1: Quick Wins
1. ✅ Cache reverse geocoding (Frontend #5)
2. ✅ Debounce URL updates (Frontend #6)
3. ✅ Add mention fetching endpoint (Backend #1)

### Week 2: State Management
4. ✅ Replace events with context (Frontend #3)
5. ✅ Consolidate mention fetching (Frontend #1)

### Week 3: UX Improvements
6. ✅ Keep create flow inline (Frontend #4)
7. ✅ Simplify pin marker state (Frontend #2)

### Week 4: Performance
8. ✅ Optimize nearby mentions query (Backend #2)
9. ✅ Add mention fetching cache (Backend #3)
10. ✅ Batch nearby mentions endpoint (Backend #4)

---

## Success Metrics

**Performance**:
- Mention sheet opens in <500ms (currently ~1-2s)
- Map click popup appears in <200ms (currently ~500ms)
- Zero duplicate API requests

**Code Quality**:
- Reduce custom events from 10+ to 0
- Reduce pin marker logic from 5+ places to 1 hook
- 50% reduction in component complexity

**User Experience**:
- Create flow stays on map (no navigation)
- Smoother interactions (no janky re-renders)
- Faster mention selection

---

## Risk Assessment

**Low Risk** (Safe to do first):
- Cache reverse geocoding
- Debounce URL updates
- Add backend endpoints (additive, doesn't break existing)

**Medium Risk** (Requires testing):
- Replace events with context (affects multiple components)
- Keep create flow inline (changes navigation pattern)

**Higher Risk** (Requires careful migration):
- Optimize nearby mentions query (database changes)
- Consolidate mention fetching (touches many components)

---

## Rollback Plan

Each change is isolated and can be rolled back independently:
- Frontend: Revert PR, redeploy
- Backend: Keep old endpoints, new ones are additive
- Database: Index changes are safe (can drop if needed)

---

## Estimated Impact

**Developer Experience**: 
- 40% reduction in debugging time
- 60% reduction in "where does this state come from?" questions

**User Experience**:
- 2x faster mention selection
- 3x faster map click response
- Smoother, more responsive interactions

**Infrastructure**:
- 50% reduction in API calls
- 80% reduction in database load for nearby queries
- Lower Mapbox geocoding costs
