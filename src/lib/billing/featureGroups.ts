/**
 * Feature grouping utilities
 * Groups features by root category (part before first underscore)
 * 
 * Examples:
 * - 'map' → 'maps' group
 * - 'map_analytics' → 'maps' group
 * - 'analytics_visitors' → 'analytics' group
 * - 'content_collections' → 'content' group
 */

export type FeatureGroup = 'maps' | 'analytics' | 'content' | 'profile' | 'other';

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
 * 
 * @example
 * getFeatureGroupFromSlug('map') → 'maps'
 * getFeatureGroupFromSlug('map_analytics') → 'maps'
 * getFeatureGroupFromSlug('analytics_visitors') → 'analytics'
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
 * Group features by their root category
 * 
 * @example
 * groupFeaturesByRoot([
 *   { slug: 'map', name: 'Maps', ... },
 *   { slug: 'map_analytics', name: 'Map Analytics', ... },
 *   { slug: 'analytics_visitors', name: 'Visitor Analytics', ... }
 * ])
 * // Returns:
 * // [
 * //   { group: 'maps', features: [map, map_analytics] },
 * //   { group: 'analytics', features: [analytics_visitors] }
 * // ]
 */
export function groupFeaturesByRoot(
  features: Array<{
    slug: string;
    name: string;
    limit_value: number | null;
    limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
    is_unlimited: boolean;
    usage?: number;
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
  // Base features (root category) first, then sub-features (with underscore)
  const groupOrder: FeatureGroup[] = ['maps', 'analytics', 'content', 'profile', 'other'];
  
  return groupOrder
    .filter(group => grouped.has(group))
    .map(group => {
      const groupFeatures = grouped.get(group)!;
      // Sort: base feature (no underscore) first, then sub-features alphabetically
      groupFeatures.sort((a, b) => {
        const aIsBase = !a.slug.includes('_');
        const bIsBase = !b.slug.includes('_');
        if (aIsBase !== bIsBase) {
          return aIsBase ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      return {
        group,
        features: groupFeatures,
      };
    });
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
    other: 'Other',
  };
  return names[group];
}

/**
 * Format feature limit for display
 */
export function formatFeatureLimit(feature: {
  limit_value: number | null;
  limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  is_unlimited: boolean;
  usage?: number;
}): string {
  if (feature.is_unlimited || feature.limit_type === 'unlimited') {
    return feature.usage !== undefined ? `${feature.usage} (unlimited)` : 'unlimited';
  }
  
  if (feature.limit_type === 'count' && feature.limit_value !== null) {
    const usage = feature.usage ?? 0;
    return `${usage} / ${feature.limit_value}`;
  }
  
  if (feature.limit_type === 'storage_mb' && feature.limit_value !== null) {
    const usage = feature.usage ?? 0;
    return `${usage} MB / ${feature.limit_value} MB`;
  }
  
  if (feature.limit_type === 'boolean') {
    return 'Enabled';
  }
  
  return 'Enabled';
}
