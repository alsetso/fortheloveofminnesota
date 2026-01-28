# Map Limits System Invariant

## Primary Invariant

**The count of owned maps must be the single source of truth for billing limits across API enforcement and UI display.**

## What This Means

1. **Owned Maps Count**: The number of maps where `map.account_id = account.id` is the authoritative count
2. **No Separate Usage Fetch**: UI components must derive usage from the owned maps array, not from a separate API call
3. **Consistent Logic**: All limit checks (UI and API) use the same calculation function
4. **Canonical Feature Slug**: All checks use `custom_maps` feature slug - no fallbacks

## Implementation

### Centralized Logic

**File**: `src/lib/billing/mapLimits.ts`

- `MAP_FEATURE_SLUG = 'custom_maps'` - Canonical feature slug constant
- `calculateMapLimitState(ownedMapsCount, feature)` - Client-side limit calculation
- `checkMapLimitServer(ownedMapsCount, featureLimit)` - Server-side limit check

Both functions enforce the invariant: owned maps count is the input, limit state is the output.

### Usage Pattern

**Client Components**:
```typescript
const ownedMapsCount = myMapsByRole.owner.length; // Source of truth
const limitState = calculateMapLimitState(ownedMapsCount, mapFeature);
// Use limitState.canCreate, limitState.isAtLimit, limitState.displayText
```

**API Routes**:
```typescript
const { count: ownedMapsCount } = await supabase
  .from('map')
  .select('*', { count: 'exact', head: true })
  .eq('account_id', accountId); // Source of truth

const limitCheck = checkMapLimitServer(ownedMapsCount ?? 0, featureLimit);
if (!limitCheck.canCreate) {
  return createErrorResponse(limitCheck.errorMessage, 403);
}
```

## Entry Points

All create-map entry points must enforce the invariant:

1. **HomeMapsSidebar** (`src/app/components/HomeMapsSidebar.tsx`)
   - Derives usage from `myMapsByRole.owner.length`
   - Uses `calculateMapLimitState()`
   - Prevents navigation if `!limitState.canCreate`

2. **NewMapPage** (`src/app/maps/new/page.tsx`)
   - Fetches owned maps count from API
   - Uses `calculateMapLimitState()` for display
   - Defensive check before submission

3. **Maps API** (`src/app/api/maps/route.ts`)
   - Counts owned maps from database
   - Uses `checkMapLimitServer()` for enforcement
   - Returns 403 with error message if limit reached

## Guardrails

1. **UI Guardrails**:
   - Disable "New" button if `!limitState.canCreate`
   - Prevent navigation to `/map/new` if at limit
   - Show error state if maps fail to load

2. **API Guardrails**:
   - Always count owned maps before allowing creation
   - Use canonical feature slug (`MAP_FEATURE_SLUG`)
   - Return clear error messages

3. **Defensive Checks**:
   - NewMapPage checks limit before submission (even though API also checks)
   - HomeMapsSidebar prevents navigation if at limit

## Error States

**HomeMapsSidebar**:
- Shows error message if maps fail to load
- Provides retry button
- Hides create link if at limit

**NewMapPage**:
- Shows limit error if user somehow reaches page at limit
- Shows API error if creation fails

## Violations to Avoid

❌ **Don't**: Fetch usage from `/api/billing/usage` separately
✅ **Do**: Count from owned maps array

❌ **Don't**: Use fallback feature slugs (`'map' || 'custom_maps'`)
✅ **Do**: Use `MAP_FEATURE_SLUG` constant

❌ **Don't**: Duplicate limit calculation logic
✅ **Do**: Use centralized functions

❌ **Don't**: Count member maps in limit calculations
✅ **Do**: Only count owned maps (`account_id` match)

## Testing the Invariant

1. **Create maps up to limit**: Verify UI shows limit reached
2. **Try to create at limit**: Verify API returns 403
3. **Verify UI matches API**: Count should be identical
4. **Test error states**: Verify error handling works

## Related Files

- `src/lib/billing/mapLimits.ts` - Centralized limit logic
- `src/app/components/HomeMapsSidebar.tsx` - Homepage maps container
- `src/app/maps/new/page.tsx` - Map creation page
- `src/app/api/maps/route.ts` - Maps API (creation endpoint)
