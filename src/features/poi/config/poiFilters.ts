import { FeatureCategory } from '@/features/map-metadata/constants/categories';

/**
 * POI Filter Configuration
 * Defines which feature types should be blocked from POI creation
 */

// Feature categories that should be blocked from POI creation
export const BLOCKED_POI_CATEGORIES: Set<FeatureCategory> = new Set([
  'road',
  'highway',
  'path',
  'bridge',
  'tunnel',
  'unknown',
] as FeatureCategory[]);

// Feature types (from properties.type) that should be blocked
export const BLOCKED_POI_TYPES: Set<string> = new Set([
  'road',
  'highway',
  'path',
  'bridge',
  'tunnel',
  'waterway',
  'river',
  'stream',
]);

// Layer IDs that should be blocked (partial matches)
export const BLOCKED_LAYER_PATTERNS: string[] = [
  'road',
  'highway',
  'path',
  'bridge',
  'tunnel',
  'water',
  'waterway',
  'river',
  'stream',
  'ferry',
];

/**
 * Check if a feature should be blocked from POI creation
 */
export function isFeatureBlocked(
  category: FeatureCategory,
  type?: string,
  layerId?: string
): boolean {
  // Check category
  if (BLOCKED_POI_CATEGORIES.has(category)) {
    return true;
  }

  // Check type
  if (type && BLOCKED_POI_TYPES.has(type.toLowerCase())) {
    return true;
  }

  // Check layer ID patterns
  if (layerId) {
    const lowerLayerId = layerId.toLowerCase();
    if (BLOCKED_LAYER_PATTERNS.some(pattern => lowerLayerId.includes(pattern))) {
      return true;
    }
  }

  return false;
}

/**
 * Get allowed POI categories (for UI display)
 */
export function getAllowedPOICategories(): FeatureCategory[] {
  // Return all categories except blocked ones
  const allCategories: FeatureCategory[] = [
    'house',
    'building',
    'park',
    'school',
    'hospital',
    'church',
    'airport',
    'cemetery',
    'golf_course',
    'watertower',
    'municipal',
    'lake',
    'city',
    'neighborhood',
    'poi',
    'restaurant',
    'hotel',
    'gas_station',
    'entertainment',
  ];

  return allCategories.filter(cat => !BLOCKED_POI_CATEGORIES.has(cat));
}
