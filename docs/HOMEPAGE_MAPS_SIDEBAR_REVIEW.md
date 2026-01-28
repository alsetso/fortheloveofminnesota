# Homepage "My Maps" Container - Invariant-Based Refactor Plan

## System Invariant

**Primary Invariant**: The count of owned maps must be the single source of truth for billing limits across API enforcement and UI display.

This invariant ensures:
- API and UI always show the same limit state
- No race conditions between separate usage fetches
- Correctness: limits are enforced based on actual owned maps, not separate counts
- Cost: eliminates redundant API calls
- Simplicity: one source of truth, easier to reason about

## Current Violations of Invariant

### Violation 1: Separate Usage Fetch
**Location**: `HomeMapsSidebar.tsx:42-66`
- Fetches usage from `/api/billing/usage` separately
- Creates potential mismatch with actual owned maps array
- Adds unnecessary API call

### Violation 2: Feature Slug Fallbacks
**Location**: `HomeMapsSidebar.tsx:37-39`, `NewMapPage.tsx:90`
- Uses fallback chain: `custom_maps || map || unlimited_maps`
- Unclear which slug is canonical
- Risk of mismatched feature lookups

### Violation 3: Duplicated Limit Logic
**Location**: Multiple components
- Same limit calculation logic in 4+ places
- Risk of logic drift
- Harder to maintain invariant consistency

## Phase 1: Mandatory Changes (Invariant Enforcement) ✅ COMPLETED

### 1. Standardize Feature Slug ✅
**Status**: Complete
- Created `MAP_FEATURE_SLUG = 'custom_maps'` constant in `src/lib/billing/mapLimits.ts`
- Removed all fallback chains:
  - `HomeMapsSidebar.tsx`: Removed `|| getFeature('map') || getFeature('unlimited_maps')`
  - `NewMapPage.tsx`: Changed from `'map' || 'custom_maps'` to `MAP_FEATURE_SLUG`
  - `MapsPage.tsx`: Removed `|| f.slug === 'map'` fallback
  - `NewMapPage.tsx` upgrade info: Changed from `'map'` to `MAP_FEATURE_SLUG`

### 2. Remove Usage Fetch ✅
**Status**: Complete
- Removed `/api/billing/usage` fetch from `HomeMapsSidebar.tsx` (lines 26-27, 41-66)
- Removed `mapUsage` state and `loadingUsage` state
- Usage now derived directly from `myMapsByRole.owner.length`

### 3. Centralize Limit Logic ✅
**Status**: Complete
- Created `calculateMapLimitState()` function in `src/lib/billing/mapLimits.ts`
- Pure function: accepts `(ownedMapsCount, feature)` → returns `{ canCreate, isAtLimit, displayText }`
- Updated `HomeMapsSidebar.tsx` to use centralized logic
- Invariant enforced: owned maps array is single source of truth

## Phase 2: Stabilization ✅ COMPLETED

### 1. Aligned All Create-Map Entry Points ✅
**Status**: Complete
- **API Route** (`src/app/api/maps/route.ts`): Uses `checkMapLimitServer()` with canonical slug
- **NewMapPage** (`src/app/maps/new/page.tsx`): Uses `calculateMapLimitState()` for display and defensive check
- **HomeMapsSidebar**: Already aligned in Phase 1

### 2. Added Guardrails ✅
**Status**: Complete
- **UI Guardrails**: 
  - HomeMapsSidebar prevents navigation if `!limitState.canCreate`
  - NewMapPage checks limit before submission (defensive)
- **API Guardrails**:
  - Always counts owned maps before allowing creation
  - Uses canonical feature slug (`MAP_FEATURE_SLUG`)
  - Returns clear error messages

### 3. Added Error State ✅
**Status**: Complete
- **HomeMapsSidebar**: Shows error message with retry button if maps fail to load
- **NewMapPage**: Shows limit error if user reaches page at limit

### 4. Documented Invariant ✅
**Status**: Complete
- Created `docs/MAP_LIMITS_INVARIANT.md` with:
  - Invariant definition
  - Implementation details
  - Usage patterns
  - Guardrails
  - Violations to avoid
  - Testing guidelines

## Phase 3: Deferred (Abstraction/Cosmetic)
**Status**: Not started - deferred until invariant is proven stable
- Type safety improvements (beyond what's needed for correctness)
- Loading skeletons
- Unified API endpoints
- Performance optimizations

## Implementation Analysis

### Component: `HomeMapsSidebar.tsx`

**Location**: `src/app/components/HomeMapsSidebar.tsx`

### Current Flow

1. **Feature Detection** (Line 37-39):
   ```typescript
   const mapFeature = useMemo(() => {
     return getFeature('custom_maps') || getFeature('map') || getFeature('unlimited_maps');
   }, [features, getFeature]);
   ```
   - Uses fallback chain with 3 different feature slugs
   - No clear priority or documentation on which slug is canonical

2. **Usage Fetching** (Line 42-66):
   - Separate API call to `/api/billing/usage`
   - Falls back through multiple keys: `custom_maps || maps || map || 0`
   - No error handling in UI
   - Loading state not coordinated with maps fetch

3. **Maps Fetching** (Line 69-193):
   - Two separate queries: owned maps (API) + member maps (Supabase direct)
   - Stats fetched separately after maps loaded
   - No error boundaries
   - Complex deduplication logic

4. **Limit Display Logic** (Line 303-318):
   - Duplicated across multiple components
   - Inconsistent formatting
   - Plan name formatting hardcoded

## Critical Issues

### 1. **Feature Slug Inconsistency**
**Problem**: Multiple feature slugs used across codebase:
- `custom_maps` (used in API route)
- `map` (used in some places)
- `unlimited_maps` (used as fallback)

**Impact**: 
- Unclear which is canonical
- Risk of mismatched limits/usage
- Maintenance burden

**Evidence**:
- `src/app/api/maps/route.ts:253` uses `'custom_maps'`
- `src/app/components/HomeMapsSidebar.tsx:38` uses fallback chain
- `src/app/api/billing/usage/route.ts:42-44` maps all three to same table

### 2. **Separate Usage Fetch**
**Problem**: Usage fetched separately instead of using feature limit data

**Impact**:
- Extra API call
- Potential race conditions
- Inconsistent data if usage updates between calls

**Current**:
```typescript
// Line 48-56: Separate fetch
const response = await fetch('/api/billing/usage', { credentials: 'include' });
const data = await response.json();
setMapUsage(data.usage?.custom_maps || data.usage?.maps || data.usage?.map || 0);
```

**Better**: Count owned maps directly from fetched maps array

### 3. **No Single Source of Truth**
**Problem**: Limit checking logic duplicated in:
- `HomeMapsSidebar.tsx` (homepage)
- `MapsPage.tsx` (maps page)
- `NewMapPage.tsx` (create map page)
- `route.ts` (API)

**Impact**: 
- Logic drift between implementations
- Harder to maintain
- Inconsistent UX

### 4. **Missing Error States**
**Problem**: No error UI for failed fetches

**Impact**: 
- Silent failures
- Poor UX when API fails
- No retry mechanism

### 5. **Type Safety Issues**
**Problem**: Extensive use of `any` types

**Locations**:
- Line 119: `(ownedData.maps || []).map((map: any) => ...)`
- Line 129: `(memberMapsData || []).map((member: any) => ...)`
- Line 160: `allMaps.map((map: any) => ...)`

**Impact**: 
- Runtime errors not caught at compile time
- Poor IDE support
- Harder refactoring

### 6. **Performance Issues**
**Problem**: Multiple sequential API calls

**Current Flow**:
1. Fetch usage (separate API call)
2. Fetch owned maps (API call)
3. Fetch member maps (Supabase query)
4. Fetch stats (API call)

**Impact**: 
- 4 round trips
- Slower initial load
- No parallelization

### 7. **Inconsistent Limit Counting**
**Problem**: Usage API counts all maps, but should only count owned maps

**Current** (`/api/billing/usage/route.ts:82`):
```typescript
.eq('account_id', accountId)  // Correct - only owned maps
```

**But** in `HomeMapsSidebar`, the usage might include member maps if the API is wrong

## Recommended Improvements

### 1. **Standardize Feature Slug**
**Action**: Choose one canonical slug (`custom_maps`) and use consistently

**Implementation**:
```typescript
// Create constant
const MAP_FEATURE_SLUG = 'custom_maps' as const;

// Use everywhere
const mapFeature = getFeature(MAP_FEATURE_SLUG);
```

**Files to update**:
- `src/app/components/HomeMapsSidebar.tsx`
- `src/app/maps/page.tsx`
- `src/app/maps/new/page.tsx`
- Any other components using map limits

### 2. **Eliminate Separate Usage Fetch**
**Action**: Count owned maps from fetched data instead of separate API call

**Implementation**:
```typescript
// Remove usage fetch, derive from maps
const mapUsage = useMemo(() => {
  return myMapsByRole.owner.length;
}, [myMapsByRole.owner.length]);
```

**Benefits**:
- One less API call
- Always in sync with displayed maps
- Simpler code

### 3. **Create Shared Limit Logic Hook**
**Action**: Extract limit checking into reusable hook

**Implementation** (`src/hooks/useMapLimits.ts`):
```typescript
export function useMapLimits(ownedMapsCount: number) {
  const { getFeature } = useBillingEntitlementsSafe();
  const MAP_FEATURE_SLUG = 'custom_maps' as const;
  
  return useMemo(() => {
    const feature = getFeature(MAP_FEATURE_SLUG);
    if (!feature) {
      return {
        hasFeature: false,
        canCreate: false,
        usage: ownedMapsCount,
        limit: null,
        isUnlimited: false,
        isAtLimit: false,
        displayText: 'Not available',
      };
    }
    
    const isUnlimited = feature.is_unlimited || feature.limit_type === 'unlimited';
    const limit = feature.limit_value;
    const isAtLimit = !isUnlimited && limit !== null && ownedMapsCount >= limit;
    
    return {
      hasFeature: true,
      canCreate: !isAtLimit,
      usage: ownedMapsCount,
      limit,
      isUnlimited,
      isAtLimit,
      displayText: isUnlimited 
        ? `${ownedMapsCount} maps (unlimited)`
        : limit !== null
        ? `${ownedMapsCount} / ${limit} maps`
        : `${ownedMapsCount} maps`,
    };
  }, [getFeature, ownedMapsCount]);
}
```

**Usage**:
```typescript
const mapLimits = useMapLimits(myMapsByRole.owner.length);
```

### 4. **Add Error Boundaries & States**
**Action**: Add proper error handling

**Implementation**:
```typescript
const [error, setError] = useState<Error | null>(null);

// In fetchMyMaps catch block:
catch (err) {
  console.error('Error fetching my maps:', err);
  setError(err instanceof Error ? err : new Error('Failed to load maps'));
  setMyMapsByRole({ owner: [], manager: [], editor: [] });
}

// In render:
{error && (
  <div className="bg-red-50 border border-red-200 rounded-md p-[10px]">
    <p className="text-xs text-red-900">
      Failed to load maps. 
      <button onClick={fetchMyMaps} className="underline ml-1">
        Retry
      </button>
    </p>
  </div>
)}
```

### 5. **Improve Type Safety**
**Action**: Define proper types for map data

**Implementation**:
```typescript
// In types file
type MapApiResponse = {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  slug: string;
  visibility: 'public' | 'private';
  settings: MapSettings;
  member_count: number;
  is_active: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  account: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
};

// Use in component
const ownedMaps = (ownedData.maps || []).map((map: MapApiResponse) => ({
  ...map,
  // ...
}));
```

### 6. **Optimize Data Fetching**
**Action**: Parallelize fetches and combine queries where possible

**Implementation**:
```typescript
const fetchMyMaps = async () => {
  setLoadingMaps(true);
  try {
    // Parallel fetch
    const [ownedResponse, memberMapsResult] = await Promise.all([
      fetch(`/api/maps?account_id=${authAccount.id}`),
      supabase
        .from('map_members')
        .select(/* ... */)
        .eq('account_id', authAccount.id)
        .eq('map.is_active', true),
    ]);
    
    // Process results...
  } catch (err) {
    // Handle error
  } finally {
    setLoadingMaps(false);
  }
};
```

**Alternative**: Create unified API endpoint that returns owned + member maps + stats in one call

### 7. **Centralize Plan Name Formatting**
**Action**: Extract plan name formatting to utility

**Implementation** (`src/lib/billing/planHelpers.ts`):
```typescript
export function formatPlanName(plan: string | null | undefined): string | null {
  if (!plan) return null;
  const normalized = plan.toLowerCase();
  const planNames: Record<string, string> = {
    hobby: 'Hobby',
    contributor: 'Contributor',
    professional: 'Professional',
    business: 'Business',
    plus: 'Pro+',
  };
  return planNames[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
```

### 8. **Add Loading Skeletons**
**Action**: Replace "Loading maps..." with skeleton UI

**Implementation**: Use existing `LoadingSkeleton` component or create map-specific skeleton

### 9. **Memoize Expensive Computations**
**Action**: Memoize grouped maps and filtered lists

**Current**: Maps re-grouped on every render
**Better**: Memoize with proper dependencies

### 10. **Consolidate API Endpoints**
**Action**: Consider unified endpoint for maps + limits + stats

**Proposed**: `/api/maps/my` returns:
```json
{
  "maps": {
    "owner": [...],
    "manager": [...],
    "editor": [...]
  },
  "limits": {
    "usage": 3,
    "limit": 5,
    "isUnlimited": false,
    "canCreate": true
  },
  "stats": {
    "map_id": { "total_views": 123 }
  }
}
```

## Priority Ranking

1. **High Priority** (Do First):
   - Standardize feature slug (#1)
   - Eliminate separate usage fetch (#2)
   - Add error states (#4)
   - Create shared limit logic hook (#3)

2. **Medium Priority** (Next Sprint):
   - Improve type safety (#5)
   - Optimize data fetching (#6)
   - Centralize plan name formatting (#7)

3. **Low Priority** (Nice to Have):
   - Add loading skeletons (#8)
   - Memoize computations (#9)
   - Consolidate API endpoints (#10)

## Code Quality Metrics

**Current State**:
- Cyclomatic Complexity: High (nested conditionals, multiple concerns)
- Type Safety: Low (extensive `any` usage)
- Testability: Low (tightly coupled, hard to mock)
- Reusability: Low (logic duplicated across components)
- Performance: Medium (multiple sequential API calls)

**After Improvements**:
- Cyclomatic Complexity: Medium (extracted hooks, clearer separation)
- Type Safety: High (proper types throughout)
- Testability: High (isolated hooks, mockable dependencies)
- Reusability: High (shared hooks, utilities)
- Performance: High (parallelized, optimized queries)

## Testing Recommendations

1. **Unit Tests**:
   - `useMapLimits` hook with various feature configurations
   - Plan name formatting utility
   - Limit calculation logic

2. **Integration Tests**:
   - Maps fetching with various account states
   - Error handling and retry logic
   - Limit enforcement

3. **E2E Tests**:
   - Full flow: login → view maps → check limits → create map
   - Limit reached state
   - Upgrade flow

## Migration Path

1. Create shared hook and utilities (non-breaking)
2. Update `HomeMapsSidebar` to use new hook (non-breaking)
3. Update other components to use same hook (non-breaking)
4. Remove old duplicated logic (breaking, but internal)
5. Standardize feature slug (breaking, requires coordination)

## Related Files

- `src/app/components/HomeMapsSidebar.tsx` - Main component
- `src/app/api/maps/route.ts` - Maps API
- `src/app/api/billing/usage/route.ts` - Usage API
- `src/app/maps/page.tsx` - Maps page (duplicate logic)
- `src/app/maps/new/page.tsx` - New map page (duplicate logic)
- `src/lib/billing/featureLimits.ts` - Server-side limit checking
- `src/contexts/BillingEntitlementsContext.tsx` - Feature context
