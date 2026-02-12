# Public Schema Migration Audit

## Status Summary

**Legacy Tables Status:**
- `public.map` (11 rows) → `maps.maps` ✅ **Data migrated, code needs update**
- `public.map_pins` (87 rows) → `maps.pins` ✅ **Data migrated, code needs update**
- `public.posts` (5 rows) → `content.posts` ✅ **Data migrated, code needs update**
- `public.mentions` (76 rows) → **IRRELEVANT** (use `maps.pins`)
- `public.mentions_likes` → **SKIP** (not needed)
- `public.map_membership_requests` → **KEEP** in public for now
- `public.collections` → **UNDECIDED** (keep in public for now)

## Files Requiring Updates

### 1. `public.map` → `maps.maps` (47 files)

**API Routes:**
- `src/app/api/maps/[id]/pins/route.ts` (2 instances)
- `src/app/api/maps/[id]/pins/[pinId]/route.ts` (5 instances)
- `src/app/api/maps/[id]/data/route.ts` (1 instance)
- `src/app/api/mentions/nearby/route.ts` (2 instances)
- `src/app/api/maps/[id]/membership-requests/my-request/route.ts` (2 instances)
- `src/app/api/maps/[id]/members/route.ts` (3 instances)
- `src/app/api/maps/[id]/members/[memberId]/route.ts` (2 instances)
- `src/app/api/maps/[id]/membership-requests/[requestId]/route.ts` (2 instances)
- `src/app/api/maps/[id]/membership-requests/route.ts` (2 instances)
- `src/app/api/maps/[id]/areas/[areaId]/route.ts` (4 instances)
- `src/app/api/maps/[id]/stats/route.ts` (1 instance)
- `src/app/api/maps/[id]/route.ts` (7 instances)
- `src/app/api/maps/[id]/areas/route.ts` (2 instances)
- `src/app/api/maps/[id]/categories/route.ts` (3 instances)
- `src/app/api/maps/[id]/publish/route.ts` (2 instances)
- `src/app/api/maps/[id]/viewers/route.ts` (1 instance)
- `src/app/api/maps/route.ts` (4 instances)
- `src/app/api/posts/route.ts` (1 instance)
- `src/app/api/posts/[id]/route.ts` (1 instance)
- `src/app/api/admin/dashboard/stats/route.ts` (1 instance)
- `src/app/api/analytics/account/route.ts` (1 instance)
- `src/app/api/maps/live/mentions/route.ts` (1 instance)
- `src/app/api/feed/pin-activity/route.ts` (3 instances)

**Pages:**
- `src/app/map/[id]/post/[postId]/page.tsx` (1 instance)
- `src/app/[username]/[collection]/page.tsx` (1 instance)
- `src/app/analytics/page.tsx` (5 instances)
- `src/app/contribute/page.tsx` (2 instances)

**Components:**
- `src/components/explore/ExploreLeftSidebar.tsx` (1 instance)
- `src/features/homepage/components/HomepageMapView.tsx` (2 instances)
- `src/components/feed/CreatePostModal.tsx` (2 instances)
- `src/features/homepage/components/LiveMap.tsx` (1 instance)
- `src/components/layout/CreateMentionContent.tsx` (1 instance)
- `src/app/map/[id]/post/[postId]/edit/page.tsx` (1 instance)

**Services/Lib:**
- `src/features/mentions/services/mentionService.ts` (1 instance)
- `src/lib/maps/urls.ts` (2 instances)
- `src/lib/maps/getAccessibleMaps.ts` (2 instances)
- `src/app/api/analytics/user-mentions/route.ts` (1 instance)

**Update Pattern:**
```typescript
// OLD
supabase.from('map')

// NEW
(supabase as any).schema('maps').from('maps')
```

### 2. `public.map_pins` → `maps.pins` (28 files)

**API Routes:**
- `src/app/api/maps/[id]/pins/route.ts` (1 instance)
- `src/app/api/maps/[id]/pins/[pinId]/route.ts` (5 instances)
- `src/app/api/maps/[id]/data/route.ts` (1 instance)
- `src/app/api/mentions/nearby/route.ts` (1 instance)
- `src/app/api/posts/route.ts` (4 instances)
- `src/app/api/posts/[id]/route.ts` (4 instances)
- `src/app/api/pins/[pinId]/route.ts` (4 instances)
- `src/app/api/pins/route.ts` (2 instances)
- `src/app/api/maps/live/mentions/route.ts` (1 instance)
- `src/app/api/feed/pin-activity/route.ts` (1 instance)
- `src/app/api/analytics/user-mentions/route.ts` (1 instance)
- `src/app/api/mentions/[id]/route.ts` (1 instance)

**Pages:**
- `src/app/map/[id]/post/[postId]/page.tsx` (1 instance)
- `src/app/post/[id]/page.tsx` (1 instance)
- `src/app/[username]/page.tsx` (1 instance)
- `src/app/[username]/[collection]/page.tsx` (1 instance)
- `src/app/mention/[id]/page.tsx` (2 instances)
- `src/app/mention/[id]/edit/page.tsx` (1 instance)
- `src/app/map/[id]/post/[postId]/edit/page.tsx` (1 instance)
- `src/app/analytics/page.tsx` (3 instances)

**Components:**
- `src/features/map/components/MentionsLayer.tsx` (1 instance)
- `src/components/maps/LiveMapRightSidebar.tsx` (2 instances)
- `src/components/feed/CreatePostModal.tsx` (1 instance)
- `src/components/layout/CreateMentionContent.tsx` (1 instance)

**Services/Hooks:**
- `src/features/mentions/services/mentionService.ts` (4 instances)
- `src/features/collections/services/collectionService.ts` (1 instance)
- `src/hooks/useMentionData.ts` (1 instance)

**Update Pattern:**
```typescript
// OLD
supabase.from('map_pins')

// NEW
(supabase as any).schema('maps').from('pins')
```

### 3. `public.posts` → `content.posts` (8 files)

**API Routes:**
- `src/app/api/posts/route.ts` (2 instances)
- `src/app/api/posts/[id]/route.ts` (5 instances)
- `src/app/api/admin/dashboard/stats/route.ts` (1 instance)

**Pages:**
- `src/app/map/[id]/post/[postId]/page.tsx` (2 instances)
- `src/app/post/[id]/page.tsx` (2 instances)
- `src/app/analytics/page.tsx` (1 instance)

**Components:**
- `src/components/explore/ExploreLeftSidebar.tsx` (1 instance)

**Update Pattern:**
```typescript
// OLD
supabase.from('posts')

// NEW
(supabase as any).schema('content').from('posts')
```

## Migration Checklist

### Phase 1: Update API Routes (Priority: High)
- [ ] Update all `/api/maps/**` routes to use `maps.maps`
- [ ] Update all `/api/pins/**` routes to use `maps.pins`
- [ ] Update all `/api/posts/**` routes to use `content.posts`
- [ ] Update `/api/mentions/**` routes (consider deprecating or redirecting)

### Phase 2: Update Pages (Priority: High)
- [ ] Update `src/app/map/[id]/post/[postId]/page.tsx`
- [ ] Update `src/app/post/[id]/page.tsx`
- [ ] Update `src/app/mention/[id]/page.tsx` (consider redirecting to maps.pins)
- [ ] Update `src/app/[username]/page.tsx`
- [ ] Update `src/app/analytics/page.tsx`

### Phase 3: Update Components & Services (Priority: Medium)
- [ ] Update `src/features/mentions/services/mentionService.ts`
- [ ] Update `src/features/map/components/MentionsLayer.tsx`
- [ ] Update `src/components/feed/CreatePostModal.tsx`
- [ ] Update `src/lib/maps/getAccessibleMaps.ts`
- [ ] Update `src/lib/maps/urls.ts`

### Phase 4: Cleanup (Priority: Low - After verification)
- [ ] Remove references to `public.mentions` (irrelevant)
- [ ] Document `public.collections` decision
- [ ] Keep `public.map_membership_requests` in public (as decided)

## Notes

- **Collections**: Keep in `public` for now until decision is made
- **Mentions**: `public.mentions` is irrelevant - all functionality uses `maps.pins`
- **Membership Requests**: Keep `public.map_membership_requests` in public schema
- **Legacy Tables**: Keep for now, drop after all code is updated and verified

## Testing Checklist

After each file update:
- [ ] Test API endpoints return correct data
- [ ] Test pages render correctly
- [ ] Verify RLS policies work with new schemas
- [ ] Check for any broken foreign key references
