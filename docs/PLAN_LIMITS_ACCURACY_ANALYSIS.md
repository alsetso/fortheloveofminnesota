# Plan Limits & Count Logic Accuracy Analysis

## Current Implementation Overview

### 1. Feature Fetching (✅ Accurate)
- **Source**: `get_account_features_with_limits(account_id)` database function
- **Logic**: 
  - Gets account's plan from `accounts.plan`
  - Handles plan inheritance (lower-tier plans)
  - Returns features with `limit_value`, `limit_type`, `is_unlimited`
  - Uses `DISTINCT ON (f.slug)` with `ORDER BY ph.display_order DESC` to prefer current plan's limit over inherited
- **Accuracy**: ✅ Correct - properly handles inheritance and plan hierarchy

### 2. Usage Counting (⚠️ Potential Issues)

**Current Implementation** (`/api/billing/usage`):
```typescript
// Maps count - used by multiple map-related features
const mapsUsage = mapCount ?? 0;
usage.maps = mapsUsage;
usage.custom_maps = mapsUsage;
usage.map = mapsUsage;
usage.unlimited_maps = mapsUsage;
```

**Issues**:
1. **Assumes all map features share same usage**: All map-related features (`custom_maps`, `map`, `unlimited_maps`) get the same count. This is correct IF they all refer to the same resource (the `map` table), but could be wrong if different features track different resources.

2. **Hardcoded feature slug mapping**: The usage API hardcodes which slugs get which counts. If a new map feature is added (e.g., `map_analytics`), it won't automatically get the map count unless manually added.

3. **No validation**: No check that the feature slug actually corresponds to the resource being counted.

**Recommendation**: 
- Create a mapping table or function that maps feature slugs to their resource tables
- Or use feature metadata (category, resource_type) to automatically determine which table to count

### 3. Feature Filtering in AccountDropdown (⚠️ Potential Issues)

**Current Logic**:
```typescript
const keyFeatureSlugs = ['custom_maps', 'map', 'posts', 'collections', 'groups'];
const keyFeatures = features.filter(f => 
  keyFeatureSlugs.some(slug => f.slug.includes(slug)) && 
  (f.limit_type === 'count' || f.is_unlimited)
);
```

**Issues**:
1. **Overly broad matching**: Uses `includes()` which could match unintended features:
   - `custom_maps` matches `custom_maps_analytics` (if it exists)
   - `map` matches `map_analytics`, `map_export`, etc.
   - This could show features that shouldn't be in the limits list

2. **Hardcoded feature list**: The `keyFeatureSlugs` array is hardcoded. New features won't appear unless manually added.

**Recommendation**:
- Use exact slug matching: `f.slug === slug` instead of `f.slug.includes(slug)`
- Or use feature category/metadata to automatically determine which features to show

### 4. Usage-to-Feature Matching (✅ Mostly Accurate)

**Current Logic**:
```typescript
const currentUsage = usage[feature.slug] ?? 0;
```

**Accuracy**: ✅ Correct - directly matches feature slug to usage key. The usage API ensures all relevant slugs are populated.

### 5. Limit Display Logic (✅ Accurate)

**Current Logic**:
```typescript
const limitDisplay = feature.is_unlimited 
  ? '∞' 
  : feature.limit_value !== null 
    ? feature.limit_value 
    : '∞';

const isAtLimit = !feature.is_unlimited && 
                 feature.limit_value !== null && 
                 currentUsage >= feature.limit_value;
```

**Accuracy**: ✅ Correct - properly handles unlimited, null limits, and at-limit detection.

## Accuracy Score: 7/10

### Strengths:
1. ✅ Database functions correctly handle plan inheritance
2. ✅ Usage counting is accurate for the resources it tracks
3. ✅ Limit comparison logic is correct
4. ✅ Feature-to-usage matching works correctly

### Weaknesses:
1. ⚠️ Feature filtering uses `includes()` which could match unintended features
2. ⚠️ Hardcoded feature slug lists need manual updates
3. ⚠️ Usage API assumes all features of a type share the same resource
4. ⚠️ No automatic mapping between feature slugs and resource tables

## Recommendations for Improvement

### 1. Fix Feature Filtering
```typescript
// Use exact matching instead of includes()
const keyFeatureSlugs = ['custom_maps', 'map', 'posts', 'collections', 'groups'];
const keyFeatures = features.filter(f => 
  keyFeatureSlugs.includes(f.slug) &&  // Exact match
  (f.limit_type === 'count' || f.is_unlimited)
);
```

### 2. Create Feature-to-Resource Mapping
```typescript
// In usage API
const FEATURE_RESOURCE_MAP: Record<string, string> = {
  'custom_maps': 'map',
  'map': 'map',
  'unlimited_maps': 'map',
  'posts': 'posts',
  'collections': 'collections',
  'groups': 'groups',
};

// Then dynamically build usage object
for (const [featureSlug, tableName] of Object.entries(FEATURE_RESOURCE_MAP)) {
  const { count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId);
  usage[featureSlug] = count ?? 0;
}
```

### 3. Use Feature Metadata
Add a `resource_table` column to `billing.features` table:
```sql
ALTER TABLE billing.features ADD COLUMN resource_table TEXT;
-- Then use it to automatically determine which table to count
```

### 4. Validate Feature-Resource Relationship
Add validation to ensure feature slugs match their intended resources before displaying.
