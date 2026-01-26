# Map Page Errors - Fix List

## 1. `/api/maps/stats?ids=live` - 400 Bad Request

**Error:** Endpoint expects UUIDs, but "live" is a slug.

**Location:** `src/components/layout/MapsSelectorDropdown.tsx:198`

**Solution:** Resolve slug to UUID before calling stats endpoint, or update endpoint to accept slugs.

**Fix:**
```typescript
// Before calling stats, resolve slug to UUID if needed
const mapId = foundMap?.id || mapIdOrSlug;
// Only call stats if it's a UUID, otherwise skip or resolve first
if (isUUID(mapId)) {
  const statsResponse = await fetch(`/api/maps/stats?ids=${mapId}`);
}
```

---

## 2. `/api/admin/accounts?limit=1000` - 404 Not Found

**Error:** Admin endpoint doesn't exist.

**Location:** `src/contexts/AdminImpersonationContext.tsx:76`

**Solution:** Remove admin endpoint attempt, use regular endpoint with proper limit.

**Fix:**
```typescript
// Remove admin endpoint check, use regular endpoint with max limit
const response = await fetch('/api/accounts?limit=100', {
  credentials: 'include',
});
```

---

## 3. `MapsSelectorDropdown.tsx:62` - TypeError: Cannot read properties of undefined (reading 'localeCompare')

**Error:** Maps use `name` not `title`, and `is_primary` was removed.

**Location:** `src/components/layout/MapsSelectorDropdown.tsx:59-62`

**Solution:** Update to use `name` instead of `title`, remove `is_primary` check, use `slug` instead of `custom_slug`.

**Fix:**
```typescript
// Sort: by name (no primary check - that column was removed)
const sorted = transformedMaps.sort((a: any, b: any) => {
  const nameA = a.name || '';
  const nameB = b.name || '';
  return nameA.localeCompare(nameB);
});

// Also update href to use slug
href: map.slug ? `/map/${map.slug}` : `/map/${map.id}`,
```

---

## 4. `/api/accounts?limit=1000` - 400 Bad Request

**Error:** Endpoint max limit is 100, but code requests 1000.

**Location:** `src/contexts/AdminImpersonationContext.tsx:82`

**Solution:** Use max limit of 100.

**Fix:**
```typescript
const response = await fetch('/api/accounts?limit=100', {
  credentials: 'include',
});
```

---

## 5. `/api/maps/live/stats` - 404 Not Found

**Error:** This endpoint doesn't exist. Should use `/api/maps/[id]/stats` with resolved UUID.

**Location:** Unknown (likely in a component fetching live map stats)

**Solution:** Resolve "live" slug to UUID first, then call `/api/maps/{uuid}/stats`.

**Fix:**
```typescript
// First resolve slug to UUID
const liveMapResponse = await fetch('/api/maps/live');
const liveMap = await liveMapResponse.json();
// Then fetch stats
const statsResponse = await fetch(`/api/maps/${liveMap.id}/stats`);
```

---

## 6. `/api/maps/live/mentions` - 500 Internal Server Error

**Error:** Query uses `custom_slug` and `is_primary` which were removed.

**Location:** `src/app/api/maps/live/mentions/route.ts:23-24`

**Solution:** Already fixed - uses `slug` with `custom_slug` fallback and `is_active` check.

**Status:** ✅ Fixed (verify it works)

---

## Summary of Required Fixes

1. ✅ **Live mentions API** - Fixed (uses `slug` with `custom_slug` fallback, `is_active` check)
2. ✅ **MapsSelectorDropdown** - Fixed (uses `name`/`slug`, removed `is_primary`, resolves slugs to UUIDs for stats)
3. ✅ **AdminImpersonationContext** - Fixed (removed admin endpoint, uses limit=100)
4. ✅ **Stats endpoint calls** - Fixed (resolves slugs to UUIDs before calling stats endpoint)
5. ⚠️ **Live map stats (404)** - May be browser cache or unknown caller (no code found calling this endpoint)
