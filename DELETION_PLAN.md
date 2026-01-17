# Deletion Plan - API & Page Cleanup

## Execution Order

### Phase 1: Pages (Entry Points)
### Phase 2: Page Components
### Phase 3: Feature Components
### Phase 4: Services
### Phase 5: API Routes
### Phase 6: Types & Utils
### Phase 7: Navigation/Config References

---

## PHASE 1: PAGES

### News
- `src/app/news/[id]/page.tsx`

### Atlas Maps
- `src/app/map/atlas/[table]/page.tsx`
- `src/app/explore/atlas/[table_name]/[id]/page.tsx` (if exists)

### Special Maps
- `src/app/map/skip-tracing/page.tsx`
- `src/app/map/realestate/page.tsx`
- `src/app/map/fraud/page.tsx`
- `src/app/map/mention/page.tsx`

### Admin
- `src/app/admin/**/page.tsx` (all admin pages)

---

## PHASE 2: PAGE COMPONENTS

### News
- `src/app/news/[id]/**/*.tsx` (any components in news folder)

### Atlas
- `src/app/map/atlas/[table]/AtlasMapClient.tsx`
- `src/app/map/atlas/[table]/components/*.tsx`

### Special Maps
- `src/app/map/skip-tracing/SkipTracingMapClient.tsx`
- `src/app/map/realestate/RealEstateMapClient.tsx`
- `src/app/map/fraud/FraudMapClient.tsx`

---

## PHASE 3: FEATURE COMPONENTS

### News
- `src/features/news/components/*.tsx`
- `src/features/news/**/*.tsx` (all news feature files)

### Feed
- `src/features/feed/components/*.tsx`
- `src/features/feed/**/*.tsx` (all feed feature files)

### Atlas
- `src/features/atlas/components/*.tsx`
- `src/features/atlas/**/*.tsx` (all atlas feature files)

### Categories
- Check if `src/features/categories/` exists

### Contact
- `src/features/contact/components/*.tsx`
- `src/features/contact/**/*.tsx`

### Intelligence
- Check if `src/features/intelligence/` exists

---

## PHASE 4: SERVICES

### News
- `src/features/news/services/*.ts`

### Feed
- `src/features/feed/services/*.ts`

### Atlas
- `src/features/atlas/services/*.ts`

### Location Searches
- `src/features/location-searches/services/*.ts`

### Mentions (if only for mention icons)
- Check `src/features/mentions/services/` for mention-icons specific code

---

## PHASE 5: API ROUTES

### News
- `src/app/api/news/route.ts`
- `src/app/api/news/[id]/route.ts`
- `src/app/api/news/all/route.ts`
- `src/app/api/news/latest/route.ts`
- `src/app/api/news/by-date/route.ts`
- `src/app/api/news/dates-with-news/route.ts`
- `src/app/api/news/generate/route.ts`
- `src/app/api/news/cron/route.ts`

### Feed
- `src/app/api/feed/route.ts`
- `src/app/api/feed/[id]/route.ts`

### Articles/Comments
- `src/app/api/article/[id]/comments/route.ts`

### Atlas
- `src/app/api/atlas/types/route.ts`
- `src/app/api/atlas/[table]/entities/route.ts`
- `src/app/api/atlas/[table]/[id]/route.ts`

### Categories
- `src/app/api/categories/route.ts`
- `src/app/api/categories/[id]/route.ts`
- `src/app/api/categories/search/route.ts`

### Points of Interest
- `src/app/api/points-of-interest/route.ts`

### Location Services
- `src/app/api/location-searches/route.ts`
- `src/app/api/address/route.ts`
- `src/app/api/geocode/autocomplete/route.ts`

### Intelligence
- `src/app/api/intelligence/chat/route.ts`

### Contact
- `src/app/api/contact/route.ts`

### Mention Icons
- `src/app/api/mention-icons/route.ts`
- `src/app/api/mention-icons/[id]/route.ts` (if exists)
- `src/app/api/mention-icons/upload-icon/route.ts` (if exists)

### Skip Trace / Proxy
- `src/app/api/skip-trace/store/route.ts`
- `src/app/api/proxy/skip-trace/**/route.ts`
- `src/app/api/proxy/zillow/**/route.ts`

### Civic (Unused)
- `src/app/api/civic/buildings/route.ts`
- `src/app/api/civic/events/route.ts`

### Analytics (Unused)
- `src/app/api/analytics/visitors/route.ts`
- `src/app/api/analytics/homepage-stats/route.ts`
- `src/app/api/analytics/live-visitors/route.ts`
- `src/app/api/analytics/atlas-map-stats/route.ts`
- `src/app/api/analytics/special-map-stats/route.ts`
- `src/app/api/analytics/my-pins/route.ts`
- `src/app/api/analytics/my-entities/route.ts`
- `src/app/api/analytics/feed-stats/route.ts`

### Billing (Unused)
- `src/app/api/billing/data/route.ts`

### Accounts (Unused)
- `src/app/api/accounts/route.ts` (verify - may be used elsewhere)

### Test Routes
- `src/app/api/test-payments/**/route.ts`

### Admin
- `src/app/api/admin/**/route.ts` (all admin API routes)

### FAQs
- `src/app/api/faqs/**/route.ts` (all FAQ routes)

---

## PHASE 6: TYPES & UTILS

### Types
- `src/types/news.ts`
- `src/types/feed.ts` (if exists)
- `src/types/atlas.ts` (if exists)
- `src/types/category.ts` (if exists)

### Utils
- `src/features/news/utils/*.ts`
- `src/features/feed/utils/*.ts`
- `src/features/atlas/utils/*.ts`

---

## PHASE 7: NAVIGATION/CONFIG REFERENCES

### Navigation
- `src/config/navigation.ts` - Remove news, feed, atlas, admin links

### Components (Shared)
- Check `src/components/` for news/feed/atlas references
- Check `src/components/layout/` for navigation items

### Homepage Components
- Check `src/features/homepage/components/` for news/feed references

---

## VERIFICATION COMMANDS

After each phase, run:
```bash
# Check for remaining imports
grep -r "NewsPageClient|ArticlePageClient|FeedList|AtlasMapClient" src/
grep -r "/api/news|/api/feed|/api/atlas" src/
grep -r "from '@/features/news|from '@/features/feed|from '@/features/atlas" src/

# TypeScript check
tsc --noEmit
```

---

## NOTES

- Keep `/calendar/events` page (uses direct DB, not API)
- Keep `/contact` page (static, doesn't use API)
- Keep `/search` page (uses Mapbox directly)
- Keep `/explore/cities`, `/explore/counties` (use direct DB)
- Verify EventService doesn't use `/api/civic/events` (confirmed: uses direct DB)
