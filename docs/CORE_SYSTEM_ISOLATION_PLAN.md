# Core System Isolation Plan

## Concept

**Goal**: Isolate the core system (homepage, live map, pins) and disable all non-core systems so admin can work on them separately without affecting the core experience.

**Timeline**: Next month - hyper focus on homepage, live map, pins with great auth/non-auth experience.

## Core System Definition

### What IS Core (Keep Active)
- **Homepage** (`/`) - Main entry point
- **Live Map** - Display of mentions/pins on map (uses `maps` schema, `live` map)
- **Pins/Mentions** - Core content type (`maps.pins` table)
- **Auth/Non-Auth Experience** - Both logged-in and logged-out users can use homepage
- **Profile Pages** (`/[username]`) - User profiles (needed for mentions)

### What IS NOT Core (Disable/Hide)
- Feed system (`/feed`, `feeds` schema)
- Stories (`/stories`, `stories` schema)
- Friends (`/friends`, `social_graph` schema)
- Groups (`/groups`, `groups` schema)
- Pages (`/pages`, `pages` schema)
- Messages (`/messages`, `messaging` schema)
- Places (`/explore/places`, `places` schema)
- Ad Center (`/ad_center`, `ads` schema)
- Analytics (`/analytics`, `analytics` schema) - except homepage stats
- Government Directory (`/gov`, `civic` schema) - disable for now
- Maps Management (`/maps`) - disable full map management UI, but keep live map data access

## Implementation Strategy

### Phase 1: System Visibility Control (Database)

1. **Mark all non-core systems as `is_visible: false` and `is_enabled: false`**
   ```sql
   UPDATE admin.system_visibility 
   SET is_visible = false, is_enabled = false 
   WHERE schema_name IN ('feeds', 'stories', 'social_graph', 'groups', 'pages', 'messaging', 'places', 'ads', 'analytics', 'civic');
   ```

2. **Keep core systems active**
   - `maps` schema - needed for live map data (but disable `/maps` route)
   - Homepage route (`/`) - always visible
   - Profile routes (`/[username]`) - always visible

3. **Create route-level exceptions**
   - `/api/maps/live/mentions` - Keep active (homepage needs this)
   - `/api/maps?slug=live` - Keep active (homepage needs this)
   - `/api/maps/[id]/pins` - Keep active for live map only
   - `/api/feed/pin-activity` - Keep active (homepage uses this)
   - `/api/analytics/homepage-stats` - Keep active (homepage stats)

### Phase 2: Navigation Cleanup

**Files to Update:**

1. **`src/components/layout/LeftSidebar.tsx`**
   - Remove: Friends, Groups, Saved, Memories, Pages, Stories, Documentation
   - Keep: Home (Love of Minnesota)

2. **`src/components/layout/NewPageWrapper.tsx`**
   - Remove from `navItems`: Maps, Explore, People, Government
   - Keep: Home
   - Remove from `moreNavItems`: All non-core items
   - Keep: Only Home

3. **`src/components/layout/RightSidebar.tsx`**
   - Keep as-is (sponsored/contacts - doesn't link to systems)

4. **`src/components/layout/HamburgerMenu.tsx`**
   - Remove: Maps, Government
   - Keep: Home, Profile (if auth)

5. **`src/config/navigation.ts`**
   - Update `appNavItems` to only include Home
   - Remove Maps, Settings (or keep Settings for account management)

### Phase 3: API Route Protection

**Create API middleware to check system visibility:**

1. **Create `src/lib/admin/apiSystemVisibility.ts`**
   ```typescript
   export async function isApiRouteEnabled(routePath: string): Promise<boolean> {
     // Check if route belongs to disabled system
     // Allow core routes: /api/maps/live/*, /api/feed/pin-activity, /api/analytics/homepage-stats
     // Block all others if system is disabled
   }
   ```

2. **Update API routes to check visibility**
   - Wrap non-core API routes with visibility check
   - Return 404/403 if system is disabled
   - Core routes always allowed

**API Routes to Protect:**
- `/api/feed/*` - Allow `pin-activity`, block others
- `/api/stories/*` - Block all
- `/api/social/*` - Block all
- `/api/messaging/*` - Block all
- `/api/pages/*` - Block all
- `/api/places/*` - Block all
- `/api/ad_center/*` - Block all
- `/api/analytics/*` - Allow `homepage-stats`, block others
- `/api/maps/*` - Allow live map routes, block management routes
- `/api/gov/*` - Block all

### Phase 4: Component Isolation

**Components that reference non-core systems:**

1. **Homepage Components** - Already isolated, but check for:
   - `HomeFeedContent.tsx` - Uses `/api/feed/pin-activity` ✅ (keep)
   - `HomepageMapView.tsx` - Uses live map ✅ (keep)
   - `PinActivityFeed.tsx` - Shows pin activity ✅ (keep)

2. **Sidebar Components** - Already identified above

3. **Layout Components** - Update navigation

### Phase 5: Database Access Control

**RLS Policies:**
- Non-core schemas already have RLS
- Ensure `maps` schema allows read access to live map data
- Ensure `maps.pins` allows read access for live map pins

**No changes needed** - RLS already handles this.

### Phase 6: Error Handling

**Graceful Degradation:**
- If non-core API is called, return 404 (not 500)
- If non-core route is accessed, redirect to `/` (already handled by middleware)
- Components should handle missing data gracefully

## Dependencies Map

### Homepage Dependencies (Keep Active)

**API Routes:**
- `GET /api/feed/pin-activity` - Pin activity feed
- `GET /api/maps/live/mentions` - Public mentions for non-auth users
- `GET /api/maps?slug=live` - Get live map ID
- `GET /api/maps/[id]/pins` - Get pins for live map
- `GET /api/analytics/homepage-stats` - Homepage statistics

**Database Tables:**
- `maps.maps` - Read live map
- `maps.pins` - Read pins/mentions
- `public.accounts` - Read account data for mentions
- `public.mentions` - Read mentions (if used)

**Components:**
- `HomeFeedContent.tsx`
- `HomepageMapView.tsx`
- `PinActivityFeed.tsx`
- `MentionsLayer.tsx` (map layer)
- `HeroSection.tsx` (non-auth)

**Services:**
- None directly - homepage uses API routes

### Non-Core Dependencies (Disable)

**Systems to Disable:**
- `feeds` schema - Feed system
- `stories` schema - Stories
- `social_graph` schema - Friends
- `groups` schema - Groups
- `pages` schema - Custom pages
- `messaging` schema - Messages
- `places` schema - Places
- `ads` schema - Ad Center
- `analytics` schema - Analytics (except homepage-stats)
- `civic` schema - Government Directory

## Implementation Checklist

### Database
- [ ] Update `admin.system_visibility` to disable non-core systems
- [ ] Create route-level exceptions for core API routes
- [ ] Verify RLS policies allow core access

### Navigation
- [ ] Update `LeftSidebar.tsx` - Remove non-core links
- [ ] Update `NewPageWrapper.tsx` - Remove non-core nav items
- [ ] Update `HamburgerMenu.tsx` - Remove non-core links
- [ ] Update `config/navigation.ts` - Core nav only

### API Routes
- [ ] Create `apiSystemVisibility.ts` helper
- [ ] Protect non-core API routes
- [ ] Whitelist core API routes
- [ ] Test API route blocking

### Components
- [ ] Audit homepage components for non-core dependencies
- [ ] Remove/hide non-core UI elements
- [ ] Ensure graceful error handling

### Testing
- [ ] Test homepage as non-auth user
- [ ] Test homepage as auth user
- [ ] Verify non-core routes redirect
- [ ] Verify non-core APIs return 404
- [ ] Verify core functionality works

## Success Criteria

1. ✅ Homepage loads and works for auth/non-auth users
2. ✅ Live map displays pins/mentions
3. ✅ Pin activity feed works
4. ✅ Non-core routes redirect to `/`
5. ✅ Non-core APIs return 404
6. ✅ Navigation only shows core links
7. ✅ No errors in console
8. ✅ Admin can still access `/admin/systems` to manage visibility

## Notes

- **Maps Schema**: Keep active for data access, but disable `/maps` route (full map management UI)
- **Profile Routes**: Keep active - needed for mention display
- **Admin Routes**: Always accessible regardless of system visibility
- **Settings**: Consider keeping `/settings` for account management (not a "system")

## Future: Re-enabling Systems

When ready to re-enable a system:
1. Set `is_visible: true` and `is_enabled: true` in `admin.system_visibility`
2. Re-add navigation links
3. Test system functionality
4. No code changes needed - system visibility controls everything
