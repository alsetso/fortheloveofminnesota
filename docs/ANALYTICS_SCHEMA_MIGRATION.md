# Analytics Schema Migration

## What Changed
Tables and functions moved from `public` to `analytics` schema:
- `page_views` → `analytics.page_views`
- `pin_views` → `analytics.pin_views`
- All functions: `analytics.record_page_view`, `analytics.record_pin_view`, `analytics.get_page_stats`, etc.

## What Needs Updating

### API Routes (Change `.from()` and `.rpc()` calls)
1. `src/app/api/admin/views/page-views/route.ts` - `.from('page_views')` → `.from('analytics.page_views')`
2. `src/app/api/admin/views/pin-views/route.ts` - `.from('pin_views')` → `.from('analytics.pin_views')`
3. `src/app/api/analytics/view/route.ts` - `.rpc('record_page_view')` → `.rpc('analytics.record_page_view')`
4. `src/app/api/analytics/pin-view/route.ts` - `.rpc('record_pin_view')` → `.rpc('analytics.record_pin_view')`
5. `src/app/api/analytics/pin-stats/route.ts` - `.from('pin_views')` + `.rpc('get_pin_stats')` + `.rpc('get_pin_viewers')`
6. `src/app/api/analytics/my-pins/route.ts` - `.from('pin_views')` + `.rpc('get_pin_stats')`
7. `src/app/api/analytics/my-entities/route.ts` - `.from('page_views')` + `.from('pin_views')` + `.rpc('get_page_stats')` + `.rpc('get_pin_stats')`
8. `src/app/api/analytics/pins/trending/route.ts` - `.from('pin_views')`
9. `src/app/api/analytics/homepage-stats/route.ts` - `.rpc('get_page_stats')`
10. `src/app/api/analytics/feed-stats/route.ts` - `.rpc('get_page_stats')`
11. `src/app/api/analytics/visitors/route.ts` - `.rpc('get_page_viewers')` + `.rpc('get_pin_viewers')`

### Type Definitions
12. `src/types/supabase.ts` - Regenerate types to include `analytics` schema

## Summary
- **11 API route files** updated
- **1 migration** created: `270_create_analytics_public_views.sql` (creates public views)
- **1 type file** needs regeneration: `src/types/supabase.ts`
- RPC calls use `analytics.function_name` format (functions stay in analytics schema)
- `.from()` calls use `page_views` and `pin_views` (via public views)
- Public views route to `analytics.page_views` and `analytics.pin_views` tables

## Type Regeneration
Run Supabase CLI to regenerate types:
```bash
supabase gen types typescript --project-id <project-id> > src/types/supabase.ts
```
Or use your existing type generation command.

