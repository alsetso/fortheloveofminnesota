# Feature Slug Root Strategy - Quick Reference

## Core Pattern

**Base Features**: Root category name with count limits (`map`, `content_collections`)
**Sub-Features**: `{root}_{action}` for boolean features (`map_analytics`, `analytics_visitors`)

**Examples**:
- `map` - Base feature (count: 3/unlimited)
- `map_analytics` - Sub-feature (boolean)
- `map_export` - Sub-feature (boolean)
- `analytics_visitors` - Sub-feature (boolean)
- `content_collections` - Base feature (count: 5/unlimited)
- `content_video` - Sub-feature (storage_mb)

## Implementation

### 1. Database
```sql
-- Add feature_group column (auto-populated from slug root)
ALTER TABLE billing.features ADD COLUMN feature_group TEXT;
UPDATE billing.features SET feature_group = 
  CASE WHEN slug = 'map' OR slug LIKE 'map_%' THEN 'maps'
       WHEN slug LIKE 'analytics_%' THEN 'analytics'
       WHEN slug LIKE 'content_%' THEN 'content'
       ELSE category END;
```

### 2. Utility Function
```typescript
// src/lib/billing/featureGroups.ts
export function getFeatureGroupFromSlug(slug: string): string {
  const root = slug.split('_')[0]; // Get part before first underscore
  if (root === 'map') return 'maps';
  if (root === 'analytics') return 'analytics';
  if (root === 'content') return 'content';
  return 'other';
}

export function groupFeaturesByRoot(features: Feature[]): GroupedFeature[] {
  // Groups features by root category for UI display
}
```

### 3. Account Dropdown
```typescript
// Group features and display by root category
const grouped = groupFeaturesByRoot(features);
{grouped.map(group => (
  <FeatureGroupSection group={group.group} features={group.features} />
))}
```

## Adding New Features

1. **Base feature with limit**: `map` (count: 3/unlimited)
2. **Sub-feature**: `map_analytics` (boolean)
3. **Auto-groups** in UI (Maps section)
4. **Use in code**: `hasFeature('map')` or `hasFeature('map_analytics')`
5. **No UI changes needed** - automatic grouping

## Migration Path

Rename existing features:
- `custom_maps` → `map` (base feature with count limit)
- `visitor_analytics` → `analytics_visitors`
- `video_uploads` → `content_video`
- `unlimited_collections` → `content_collections` (base feature with count limit)

Then update code references (grep/replace).
