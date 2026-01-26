# Billing Feature Grouping Strategy

## Overview

Use root category names (like `map`) as base features with count limits, then prefix sub-features with the root (like `map_analytics`). This creates natural grouping in the account dropdown and across the application.

## Core Strategy

### 1. Feature Slug Naming Convention

**Pattern**: Root category for base feature with limits, `{root}_{action}` for sub-features

**Root Categories** (base features with count/limits):
- `map` - Base map feature (count limit: 3 for hobby, unlimited for contributor+)
- `analytics` - Base analytics feature (boolean access)
- `content` - Base content feature (collections count, etc.)
- `profile` - Base profile feature (boolean access)

**Sub-Features** (prefixed with root):
- `map_analytics` - Map analytics (boolean)
- `map_export` - Export map data (boolean)
- `map_collaboration` - Advanced collaboration tools (boolean)
- `analytics_visitors` - Visitor analytics (boolean)
- `analytics_charts` - Time-series charts (boolean)
- `analytics_export` - Export analytics data (boolean)
- `content_video` - Video uploads (storage_mb limit)
- `content_extended_text` - Extended text length (boolean)
- `content_collections` - Collections (count limit: 5 for hobby, unlimited for contributor+)

**Examples**:
- `map` - Create maps (count: 3/unlimited)
- `map_analytics` - View analytics on maps (boolean)
- `map_export` - Export map data (boolean)
- `analytics_visitors` - Visitor analytics (boolean)
- `content_video` - Video uploads (storage_mb)
- `content_collections` - Collections (count: 5/unlimited)

### 2. Feature Grouping by Root Category

Features are grouped by their root category (the part before the first underscore):

**Feature Groups** (displayed in UI):
1. **Maps** - All features starting with `map` or `map_*`
2. **Analytics** - All features starting with `analytics` or `analytics_*`
3. **Content** - All features starting with `content` or `content_*`
4. **Profile** - All features starting with `profile` or `profile_*`

**Grouping Logic**:
- `map` → Maps group (base feature with count limit)
- `map_analytics` → Maps group (sub-feature)
- `map_export` → Maps group (sub-feature)
- `analytics_visitors` → Analytics group (sub-feature)
- `content_collections` → Content group (base feature with count limit)
- `content_video` → Content group (sub-feature)

### 3. Database Schema Enhancement

Add `feature_group` column to `billing.features` table (derived from slug root):

```sql
ALTER TABLE billing.features
ADD COLUMN IF NOT EXISTS feature_group TEXT;

-- Auto-populate from slug root (part before first underscore, or whole slug if no underscore)
UPDATE billing.features
SET feature_group = CASE
  WHEN slug = 'map' OR slug LIKE 'map_%' THEN 'maps'
  WHEN slug = 'analytics' OR slug LIKE 'analytics_%' THEN 'analytics'
  WHEN slug = 'content' OR slug LIKE 'content_%' THEN 'content'
  WHEN slug = 'profile' OR slug LIKE 'profile_%' THEN 'profile'
  ELSE COALESCE(category, 'other')
END;

-- Create index for grouping
CREATE INDEX IF NOT EXISTS idx_billing_features_group 
ON billing.features(feature_group) 
WHERE feature_group IS NOT NULL;
```

### 4. Account Dropdown Implementation

**Location**: `src/features/auth/components/AccountDropdown.tsx`

**Structure**:
```
Plan & Limits
├── Plan: Contributor
├── Maps
│   ├── Maps: 5 / unlimited (base feature: map)
│   ├── Analytics: Enabled (map_analytics)
│   └── Export: Enabled (map_export)
├── Analytics
│   ├── Visitors: Enabled (analytics_visitors)
│   └── Charts: Enabled (analytics_charts)
├── Content
│   ├── Collections: 3 / unlimited (content_collections)
│   └── Video Uploads: Enabled (content_video)
└── [View Plans & Limits] button
```

### 5. Feature Grouping Utility

Create `src/lib/billing/featureGroups.ts`:

```typescript
export type FeatureGroup = 'maps' | 'analytics' | 'content' | 'profile' | 'collaboration' | 'other';

export interface GroupedFeature {
  group: FeatureGroup;
  features: Array<{
    slug: string;
    name: string;
    limit_value: number | null;
    limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
    is_unlimited: boolean;
    usage?: number; // Current usage count
  }>;
}

/**
 * Extract feature group from slug root
 * Returns the part before the first underscore, or the whole slug if no underscore
 */
export function getFeatureGroupFromSlug(slug: string): FeatureGroup {
  const root = slug.split('_')[0];
  
  if (root === 'map') return 'maps';
  if (root === 'analytics') return 'analytics';
  if (root === 'content') return 'content';
  if (root === 'profile') return 'profile';
  
  return 'other';
}

/**
 * Group features by their prefix
 */
export function groupFeaturesByPrefix(
  features: Array<{
    slug: string;
    name: string;
    limit_value: number | null;
    limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
    is_unlimited: boolean;
  }>
): GroupedFeature[] {
  const grouped = new Map<FeatureGroup, GroupedFeature['features']>();
  
  features.forEach((feature) => {
    const group = getFeatureGroupFromSlug(feature.slug);
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push(feature);
  });
  
  // Convert to array and sort by group order
  const groupOrder: FeatureGroup[] = ['maps', 'analytics', 'content', 'profile', 'collaboration', 'other'];
  return groupOrder
    .filter(group => grouped.has(group))
    .map(group => ({
      group,
      features: grouped.get(group)!,
    }));
}

/**
 * Get display name for feature group
 */
export function getFeatureGroupDisplayName(group: FeatureGroup): string {
  const names: Record<FeatureGroup, string> = {
    maps: 'Maps',
    analytics: 'Analytics',
    content: 'Content',
    profile: 'Profile',
    collaboration: 'Collaboration',
    other: 'Other',
  };
  return names[group];
}
```

### 6. Migration Strategy for Existing Features

**Step 1**: Rename existing features to use root category pattern:

```sql
-- Map features: custom_maps becomes 'map' (base feature with count limit)
UPDATE billing.features SET slug = 'map' WHERE slug = 'custom_maps';
-- Keep unlimited_maps as separate or merge into map with unlimited limit_type

-- Analytics features: use analytics_* prefix
UPDATE billing.features SET slug = 'analytics_visitors' WHERE slug = 'visitor_analytics';
UPDATE billing.features SET slug = 'analytics_identities' WHERE slug = 'visitor_identities';
UPDATE billing.features SET slug = 'analytics_charts' WHERE slug = 'time_series_charts';
UPDATE billing.features SET slug = 'analytics_export' WHERE slug = 'export_data';
UPDATE billing.features SET slug = 'analytics_geographic' WHERE slug = 'geographic_data';
UPDATE billing.features SET slug = 'analytics_referrer' WHERE slug = 'referrer_tracking';
UPDATE billing.features SET slug = 'analytics_realtime' WHERE slug = 'real_time_updates';
UPDATE billing.features SET slug = 'analytics_historical' WHERE slug = 'all_time_historical_data';

-- Content features: use content_* prefix
UPDATE billing.features SET slug = 'content_extended_text' WHERE slug = 'extended_text';
UPDATE billing.features SET slug = 'content_video' WHERE slug = 'video_uploads';
UPDATE billing.features SET slug = 'content_collections' WHERE slug = 'unlimited_collections';

-- Profile features: use profile_* prefix
UPDATE billing.features SET slug = 'profile_gold_border' WHERE slug = 'gold_profile_border';
UPDATE billing.features SET slug = 'profile_advanced' WHERE slug = 'advanced_profile_features';
```

**Step 2**: Update all code references to use new slugs (grep and replace).

**Step 3**: Add `feature_group` column and populate from slugs.

### 7. Usage Tracking Integration

For features with count limits, fetch current usage:

```typescript
// src/lib/billing/usageTracking.ts
export async function getFeatureUsage(
  accountId: string,
  featureSlug: string
): Promise<number | null> {
  // Map feature slugs to usage queries
  const usageQueries: Record<string, () => Promise<number>> = {
    'map': async () => {
      const response = await fetch(`/api/maps?account_id=${accountId}`);
      const data = await response.json();
      return data.maps?.length || 0;
    },
    'content_collections': async () => {
      const response = await fetch(`/api/collections?account_id=${accountId}`);
      const data = await response.json();
      return data.collections?.length || 0;
    },
    // Add more as needed
  };
  
  const query = usageQueries[featureSlug];
  if (!query) return null;
  
  return await query();
}
```

### 8. Account Dropdown Component Updates

**Enhanced Plan & Limits Section**:

```typescript
// In AccountDropdown.tsx
const { features } = useBillingEntitlementsSafe();
const groupedFeatures = groupFeaturesByPrefix(features);

// Render grouped features
{groupedFeatures.map((group) => (
  <div key={group.group} className="space-y-1.5">
    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
      {getFeatureGroupDisplayName(group.group)}
    </div>
    {group.features.map((feature) => (
      <div key={feature.slug} className="flex items-center justify-between">
        <span className="text-xs text-gray-600">{feature.name}</span>
        <span className="text-xs font-medium text-gray-900">
          {formatFeatureLimit(feature)}
        </span>
      </div>
    ))}
  </div>
))}
```

### 9. Global Feature Access Pattern

**Check feature access**:

```typescript
// Old way (hardcoded)
if (account.plan === 'contributor') { ... }

// New way (slug-based)
if (hasFeature('map')) { ... } // Check map creation access
if (hasFeature('map_analytics')) { ... } // Check map analytics access
if (hasFeature('analytics_visitors')) { ... } // Check visitor analytics
```

**Benefits**:
- Consistent naming across codebase
- Easy to discover features (grep `map*` or `analytics*`)
- Automatic grouping in UI by root category
- Base features have limits, sub-features are boolean
- Seamless addition of new features

### 10. Adding New Features

**Process**:

1. **Create base feature with count limit**:
```sql
INSERT INTO billing.features (slug, name, description, category, feature_group)
VALUES (
  'map',
  'Maps',
  'Create custom maps',
  'maps',
  'maps'  -- Auto-set from slug root
);

-- Assign with count limit
INSERT INTO billing.plan_features (plan_id, feature_id, limit_value, limit_type)
SELECT p.id, f.id, 
  CASE WHEN p.slug = 'hobby' THEN 3 ELSE NULL END,
  CASE WHEN p.slug = 'hobby' THEN 'count' ELSE 'unlimited' END
FROM billing.plans p
CROSS JOIN billing.features f
WHERE f.slug = 'map';
```

2. **Create sub-feature (boolean)**:
```sql
INSERT INTO billing.features (slug, name, description, category, feature_group)
VALUES (
  'map_analytics',
  'Map Analytics',
  'View analytics on owned maps',
  'maps',
  'maps'  -- Auto-set from slug root
);

-- Assign as boolean feature
INSERT INTO billing.plan_features (plan_id, feature_id, limit_value, limit_type)
SELECT p.id, f.id, 1, 'boolean'
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'contributor'
  AND f.slug = 'map_analytics';
```

3. **Use in code**:
```typescript
if (hasFeature('map')) {
  // Check map creation access
  const limit = await getAccountFeatureLimit(accountId, 'map');
  // limit.limit_value = 3 or null (unlimited)
}

if (hasFeature('map_analytics')) {
  // Show analytics UI
}
```

4. **Automatically appears in**:
   - Account dropdown (grouped under "Maps")
   - Plans page (grouped by category)
   - Admin billing UI (grouped by category)

## Implementation Checklist

- [ ] Add `feature_group` column to `billing.features`
- [ ] Create migration to rename existing features with root category pattern (`map`, `analytics_*`, etc.)
- [ ] Create `featureGroups.ts` utility
- [ ] Update `AccountDropdown.tsx` to show grouped features
- [ ] Update all feature checks to use new slugs
- [ ] Add usage tracking for count-limited features
- [ ] Update plans page to use grouped display
- [ ] Update admin billing UI to use grouped display
- [ ] Add feature group icons/colors for visual distinction

## Benefits

1. **Discoverability**: Easy to find all map features (`map*` or grep `^map`)
2. **Consistency**: Uniform naming across all features
3. **Grouping**: Automatic UI grouping by prefix
4. **Extensibility**: Add new features without UI changes
5. **Maintainability**: Clear feature organization
6. **User Experience**: Better plan/limits visibility in account dropdown
