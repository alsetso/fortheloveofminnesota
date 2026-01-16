# Strategic Security Implementation Plan

**Date:** 2025-01-27  
**Goal:** Efficiently secure remaining routes and clean up unused code

## Strategy Overview

### Three-Phase Approach:
1. **Audit & Cleanup** - Remove unused routes, identify actively used routes
2. **Batch Implementation** - Apply security in logical groups
3. **Verification** - Test and verify each batch

## Phase 1: Audit & Route Analysis

### Step 1: Identify Actively Used Routes

**Method:** Search codebase for API route usage patterns

**Tools:**
- `grep -r "/api/" src/` - Find all API calls
- Service files - Check service layer usage
- Component files - Check direct fetch calls

### Step 2: Categorize Routes

#### Category A: Actively Used (Secure First)
- Routes called from production UI
- Routes used by service layers
- Routes referenced in multiple places

#### Category B: Potentially Unused (Audit)
- Routes with no references in codebase
- Routes only in test files
- Routes with deprecated patterns

#### Category C: Admin/Internal (Secure Second)
- Admin routes (already have admin checks)
- Internal utility routes
- Development-only routes

### Step 3: Identify Unused Routes

**Candidates for Removal:**
- `/api/test-payments/create-intent` - Test route, remove in production
- Routes with zero references in codebase
- Deprecated routes (check git history)

## Phase 2: Batch Implementation Strategy

### Batch 1: High-Traffic Public Routes (2 hours)
**Priority:** Highest - Most exposed to abuse

**Routes:**
- `/api/analytics/*` (11 routes) - Already have 1 done
- `/api/news/*` (7 routes) - 1 already has rate limiting
- `/api/atlas/*` (3 routes)
- `/api/civic/*` (6 routes)

**Pattern:**
```typescript
// Simple GET route pattern
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, querySchema);
      if (!validation.success) return validation.error;
      
      // Existing logic
    },
    { rateLimit: 'public' }
  );
}
```

**Effort:** 15-20 minutes per route (mostly copy-paste)

### Batch 2: Maps Routes (3 hours)
**Priority:** High - User-generated content

**Routes:**
- `/api/maps/[id]/*` (8 routes)

**Pattern:**
```typescript
// Requires ownership checks for PUT/DELETE
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      // Validate path params
      const pathValidation = validatePathParams(params, { id: z.string().uuid() });
      if (!pathValidation.success) return pathValidation.error;
      
      // Check ownership
      const { requireOwnership } = await import('@/lib/security/accessControl');
      const ownership = await requireOwnership('map', params.id, accountId);
      if (!ownership.success) return ownership.error;
      
      // Existing logic
    },
    { rateLimit: 'authenticated', requireAuth: true }
  );
}
```

**Effort:** 30 minutes per route (need ownership logic)

### Batch 3: Feed Routes (2 hours)
**Priority:** High - User-generated content

**Routes:**
- `/api/feed` (GET/POST)

**Pattern:**
```typescript
// POST requires validation for media
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      const validation = await validateRequestBody(req, postSchema, REQUEST_SIZE_LIMITS.form);
      if (!validation.success) return validation.error;
      
      // Existing logic
    },
    { 
      rateLimit: 'authenticated', 
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.form // 10MB for media
    }
  );
}
```

**Effort:** 1-2 hours (need media validation)

### Batch 4: Admin Routes (3 hours)
**Priority:** Medium - Already have admin checks

**Routes:**
- `/api/admin/*` (15 routes)

**Pattern:**
```typescript
// Already have admin checks, just wrap with security
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      // Existing admin check (keep it)
      await requireAdmin();
      
      // Existing logic
    },
    { rateLimit: 'admin', requireAdmin: true }
  );
}
```

**Effort:** 20 minutes per route (mostly wrapper)

### Batch 5: Remaining Routes (5 hours)
**Priority:** Low - Lower traffic

**Routes:**
- `/api/categories/*` (3 routes)
- `/api/points-of-interest` (1 route)
- `/api/mention-icons` (1 route)
- `/api/skip-trace/store` (1 route)
- `/api/location-searches` (1 route)
- Other misc routes

**Effort:** 15-30 minutes per route

## Phase 3: Cleanup Strategy

### Step 1: Remove Unused Routes

**Before Removing:**
1. Search codebase for route usage
2. Check git history for last usage
3. Check if route is in API documentation
4. Verify no external integrations use it

**Safe to Remove:**
- `/api/test-payments/create-intent` - Test route
- Routes with zero references
- Deprecated routes (document removal)

**Action:**
```bash
# Create cleanup branch
git checkout -b cleanup/unused-routes

# Remove unused routes
rm src/app/api/test-payments/create-intent/route.ts

# Update API inventory
# Commit with clear message
git commit -m "Remove unused test payment route"
```

### Step 2: Consolidate Similar Routes

**Opportunities:**
- Multiple analytics routes → Could use query params instead
- Similar GET routes → Could share validation logic

**Decision:** Keep separate for now (easier to maintain)

### Step 3: Update Documentation

**Files to Update:**
- `docs/API_SURFACE_INVENTORY.md` - Remove deleted routes
- `docs/SECURITY_CHECKLIST.md` - Mark completed routes
- `docs/SECURITY_STATUS.md` - Update progress

## Implementation Workflow

### For Each Batch:

1. **Create Feature Branch**
   ```bash
   git checkout -b security/batch-1-public-routes
   ```

2. **Apply Pattern to All Routes in Batch**
   - Use find/replace where possible
   - Copy from existing secured routes
   - Test each route after securing

3. **Test Batch**
   ```bash
   # Test rate limiting
   for i in {1..11}; do curl http://localhost:3000/api/analytics/homepage-stats; done
   
   # Test validation
   curl http://localhost:3000/api/analytics/homepage-stats?limit=999
   ```

4. **Commit Batch**
   ```bash
   git add src/app/api/analytics/
   git commit -m "Secure analytics routes with rate limiting and validation"
   ```

5. **Merge to Main**
   ```bash
   git checkout main
   git merge security/batch-1-public-routes
   ```

## Route Usage Analysis

### Actively Used Routes (Secure First)

**Analytics:**
- ✅ `/api/analytics/view` - Used by `usePageView` hook
- `/api/analytics/homepage-stats` - Used by `HomepageStatsModal`
- `/api/analytics/atlas-map-stats` - Used by `AtlasMapClient`
- `/api/analytics/live-visitors` - Used by `VisitorStats`
- `/api/analytics/visitors` - Used by `AnalyticsClient`
- `/api/analytics/my-pins` - Used by `AnalyticsClient`
- `/api/analytics/my-entities` - Used by `AnalyticsClient`
- `/api/analytics/pin-view` - Used by `usePinView` hook
- `/api/analytics/special-map-stats` - Used by `SpecialMapViewTracker`
- `/api/analytics/special-map-view` - Used by `SpecialMapViewTracker`
- `/api/analytics/map-view` - Used by map components
- `/api/analytics/feed-stats` - Used by feed components

**News:**
- `/api/news/latest` - Used by `NewsPageClient`, `CalendarPageClient`
- `/api/news/all` - Used by `NewsContent`
- `/api/news/[id]` - Used by `ArticlePageClient`
- `/api/news/by-date` - Used by calendar components
- `/api/news/dates-with-news` - Used by `CalendarPageClient`
- `/api/news/generate` - Used by admin components

**Maps:**
- ✅ `/api/maps` (GET/POST) - Used by `MapsSidebarContent`, `CreateMapClient`
- `/api/maps/[id]` - Used by map detail pages
- `/api/maps/[id]/pins` - Used by `MapEntitySlideUp`
- `/api/maps/[id]/stats` - Used by map components
- `/api/maps/[id]/viewers` - Used by `MapViewersModal`
- `/api/maps/stats` - Used by map listing

**Atlas:**
- `/api/atlas/types` - Used by atlas components
- `/api/atlas/[table]/entities` - Used by `AtlasMapClient`
- `/api/atlas/[table]/[id]` - Used by atlas detail views

**Civic:**
- `/api/civic/buildings` - Used by `GovernmentBuildingsLayer`
- `/api/civic/events` - Used by event components
- `/api/civic/county-boundaries` - Used by `CountyBoundariesLayer`
- `/api/civic/ctu-boundaries` - Used by `CTUBoundariesLayer`
- `/api/civic/congressional-districts` - Used by `CongressionalDistrictsLayer`
- `/api/civic/state-boundary` - Used by `StateBoundaryLayer`

**Feed:**
- `/api/feed` (GET) - Used by `FeedList`
- `/api/feed` (POST) - Used by `PostPublisherModal`

**Accounts:**
- ✅ `/api/accounts` - Used by `ProfilesClient`
- ✅ `/api/accounts/onboard` - Used by `OnboardingClient`

**Billing:**
- ✅ `/api/billing/data` - Used by `BillingModal`
- ✅ `/api/billing/checkout` - Used by `BillingModal`

### Potentially Unused Routes (Audit)

**Test Routes:**
- `/api/test-payments/create-intent` - **REMOVE** (test only)

**Low Usage:**
- `/api/article/[id]/comments` - Check if used
- `/api/location-searches` - Check usage
- `/api/skip-trace/store` - Check if still used

**Admin Routes:**
- All admin routes are used by admin components (keep)

## Recommended Implementation Order

### Week 1: High-Impact, Low-Effort
1. **Day 1:** Batch 1 - Public routes (analytics, news, atlas, civic) - 2 hours
2. **Day 2:** Batch 4 - Admin routes (already protected) - 3 hours
3. **Day 3:** Batch 5 - Remaining simple routes - 3 hours

**Total:** 8 hours, ~40 routes secured

### Week 2: Complex Routes
4. **Day 1:** Batch 2 - Maps routes (ownership checks) - 3 hours
5. **Day 2:** Batch 3 - Feed routes (media validation) - 2 hours
6. **Day 3:** Cleanup unused routes - 1 hour
7. **Day 4:** Testing and verification - 2 hours

**Total:** 8 hours, ~10 routes secured + cleanup

## Cleanup Checklist

### Before Removing Routes:
- [ ] Search codebase for route usage
- [ ] Check git history (when last used)
- [ ] Check API documentation
- [ ] Verify no external integrations
- [ ] Create backup branch

### Routes to Remove:
- [ ] `/api/test-payments/create-intent` - Test route
- [ ] Any routes with zero references

### After Removing:
- [ ] Update `docs/API_SURFACE_INVENTORY.md`
- [ ] Update `docs/SECURITY_CHECKLIST.md`
- [ ] Update `docs/SECURITY_STATUS.md`
- [ ] Commit with clear message

## Success Metrics

### Completion Criteria:
- [ ] All actively used routes secured
- [ ] Unused routes removed
- [ ] All routes tested
- [ ] Documentation updated
- [ ] Zero security vulnerabilities in critical routes

### Quality Metrics:
- [ ] 100% of routes have rate limiting
- [ ] 100% of POST/PUT routes have validation
- [ ] 100% of authenticated routes verify auth
- [ ] 100% of admin routes verify admin
- [ ] 0 unused routes in codebase

## Tools & Scripts

### Route Usage Checker
```bash
# Find all API route files
find src/app/api -name "route.ts" | while read file; do
  route=$(echo $file | sed 's|src/app/api||' | sed 's|/route.ts||')
  count=$(grep -r "$route" src/ --exclude-dir=node_modules | wc -l)
  echo "$route: $count references"
done
```

### Batch Security Application Script
```bash
# Apply security to all routes in a directory
for file in src/app/api/analytics/*/route.ts; do
  # Apply security pattern (manual for now)
  echo "Securing $file"
done
```

## Next Steps

1. **Immediate:** Run route usage analysis
2. **This Week:** Secure Batch 1 (public routes)
3. **Next Week:** Secure Batches 2-3 (complex routes)
4. **Week 3:** Cleanup and verification

---

**Estimated Total Time:** 16 hours
**Routes to Secure:** 50 actively used routes
**Routes to Remove:** 1-3 unused routes
**Final Count:** ~50 secured routes (down from 74)
