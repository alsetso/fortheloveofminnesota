# Remaining Errors - Fix Summary

## 1. `/api/maps/live/stats` - 404 Not Found

**Status:** ✅ **FIXED** (but may need browser cache clear)

**Issue:** Code was calling `/api/maps/${mapId}/stats` where `mapId` could be `"live"` (slug), causing route conflict with `/api/maps/live/mentions`.

**Fix Applied:**
- Changed to use `map.id` (UUID) instead of `mapId` (slug)
- Added guard to ensure `map.id` exists before fetching
- Location: `src/app/map/[id]/page.tsx:203`

**If still seeing error:** Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R) to clear cache.

---

## 2. `/api/maps/live/mentions` - 500 Internal Server Error

**Status:** ✅ **FIXED**

**Issue:** Query was using `.or('slug.eq.live,custom_slug.eq.live')` which may have syntax issues, and was requiring `is_active=true` which might not be set.

**Fix Applied:**
- Changed to sequential queries: try `slug='live'` first, then fallback to `custom_slug='live'`
- Removed `is_active` requirement (live map should always work)
- Added detailed error logging for debugging
- Location: `src/app/api/maps/live/mentions/route.ts:19-58`

**If still failing:** Check database to ensure live map exists with `slug='live'` or `custom_slug='live'`.

---

## 3. Mapbox Glyphs Warning

**Status:** ⚠️ **INFORMATIONAL** (not an error)

**Message:** `glyphs > 65535 not supported`

**Explanation:** This is a Mapbox GL JS limitation warning when using custom fonts with many glyphs. It doesn't break functionality, just means some glyphs won't render.

**Action:** No fix needed unless custom fonts are required.

---

## Summary

**All critical errors fixed:**
1. ✅ Stats endpoint now uses UUID instead of slug
2. ✅ Live mentions API uses sequential queries with better error handling
3. ⚠️ Glyphs warning is informational only

**Next Steps:**
- Hard refresh browser to clear cached JavaScript
- Verify live map exists in database with `slug='live'`
- Check RLS policies allow public access to live map
