/**
 * Feature extraction service for Mapbox map features
 * Centralizes all logic for extracting and categorizing map features
 * 
 * Supports comprehensive detection of atlas entity types:
 * - neighborhoods, schools, parks, lakes, hospitals, churches,
 *   cemeteries, airports, golf_courses, watertowers, municipals, roads
 */

import {
  FeatureCategory,
  ROAD_CATEGORIES,
  PLACE_CATEGORIES,
  LANDUSE_CATEGORIES,
  WATER_CATEGORIES,
  BUILDING_CATEGORIES,
  POI_CATEGORIES,
  POI_TYPE_CATEGORIES,
  MAKI_CATEGORIES,
  CATEGORY_CONFIG,
  getAtlasTypeFromCategory,
  shouldShowIntelligence,
} from '../constants/categories';

export interface ExtractedFeature {
  // Core identification
  layerId: string;
  sourceLayer: string | null;

  // Display
  name: string | null;
  category: FeatureCategory;
  icon: string;
  label: string;

  // Raw data
  properties: Record<string, any>;

  // Computed
  displayLabel: string;
  hasUsefulData: boolean;
  
  // Atlas integration
  atlasType: string | null; // Maps to AtlasEntityType if applicable
  showIntelligence: boolean; // True for house/residential buildings
}

// Cache for category lookups to avoid recomputation
const categoryCache = new Map<string, FeatureCategory>();

/**
 * Get category from cached lookup or compute and cache
 */
function getCachedCategory(
  cacheKey: string,
  compute: () => FeatureCategory
): FeatureCategory {
  if (categoryCache.has(cacheKey)) {
    return categoryCache.get(cacheKey)!;
  }
  const category = compute();
  categoryCache.set(cacheKey, category);
  return category;
}

/**
 * Determine the category of a feature based on its layer and properties
 * 
 * Priority order:
 * 1. Specific POI type (e.g., "Church", "Hospital")
 * 2. Maki icon (Mapbox's POI icon system)
 * 3. Building type (e.g., house, church, school)
 * 4. POI class (e.g., education, medical)
 * 5. Landuse (e.g., cemetery, golf_course)
 * 6. Water type
 * 7. Place type (city, neighborhood)
 * 8. Road class
 * 9. Layer ID pattern matching
 */
export function determineCategory(
  layerId: string,
  properties: Record<string, any>
): FeatureCategory {
  const cls = properties.class || '';
  const type = properties.type || '';
  const maki = properties.maki || '';
  const cacheKey = `${layerId}:${cls}:${type}:${maki}`;

  return getCachedCategory(cacheKey, () => {
    // 1. Check specific POI type first (highest priority)
    if (type && POI_TYPE_CATEGORIES[type]) {
      return POI_TYPE_CATEGORIES[type];
    }
    
    // 2. Check maki icon (Mapbox POI icons)
    if (maki && MAKI_CATEGORIES[maki]) {
      return MAKI_CATEGORIES[maki];
    }

    // 3. Check building types (important for house detection)
    if (layerId.includes('building')) {
      if (type && BUILDING_CATEGORIES[type]) {
        return BUILDING_CATEGORIES[type];
      }
      // Default building if no specific type
      return 'building';
    }

    // 4. Check POI class
    if (layerId.includes('poi') || layerId.includes('label')) {
      if (cls && POI_CATEGORIES[cls]) {
        return POI_CATEGORIES[cls];
      }
    }

    // 5. Check landuse categories (includes cemetery, golf_course)
    if (layerId.includes('landuse') || layerId.includes('land_use')) {
      if (cls && LANDUSE_CATEGORIES[cls]) {
        return LANDUSE_CATEGORIES[cls];
      }
      if (type && LANDUSE_CATEGORIES[type]) {
        return LANDUSE_CATEGORIES[type];
      }
    }

    // 6. Check water categories
    if (layerId.includes('water')) {
      if (type && WATER_CATEGORIES[type]) {
        return WATER_CATEGORIES[type];
      }
      return 'lake';
    }

    // 7. Check place categories (city, neighborhood)
    // Also check settlement-label layer which Mapbox uses for towns/villages
    if (layerId.includes('place') || layerId.includes('settlement')) {
      if (type && PLACE_CATEGORIES[type]) {
        return PLACE_CATEGORIES[type];
      }
      if (cls && PLACE_CATEGORIES[cls]) {
        return PLACE_CATEGORIES[cls];
      }
    }

    // 8. Check road categories
    if (
      layerId.includes('road') ||
      layerId.includes('highway') ||
      layerId.includes('path') ||
      layerId.includes('bridge') ||
      layerId.includes('tunnel')
    ) {
      if (cls && ROAD_CATEGORIES[cls]) {
        return ROAD_CATEGORIES[cls];
      }
      if (type && ROAD_CATEGORIES[type]) {
        return ROAD_CATEGORIES[type];
      }
    }

    // 9. Check park layers
    if (layerId.includes('park')) {
      return 'park';
    }

    // 10. Fallback checks - try all category maps
    if (cls) {
      if (ROAD_CATEGORIES[cls]) return ROAD_CATEGORIES[cls];
      if (POI_CATEGORIES[cls]) return POI_CATEGORIES[cls];
      if (LANDUSE_CATEGORIES[cls]) return LANDUSE_CATEGORIES[cls];
      if (BUILDING_CATEGORIES[cls]) return BUILDING_CATEGORIES[cls];
    }
    
    if (type) {
      if (POI_TYPE_CATEGORIES[type]) return POI_TYPE_CATEGORIES[type];
      if (WATER_CATEGORIES[type]) return WATER_CATEGORIES[type];
      if (LANDUSE_CATEGORIES[type]) return LANDUSE_CATEGORIES[type];
      if (BUILDING_CATEGORIES[type]) return BUILDING_CATEGORIES[type];
    }

    return 'unknown';
  });
}

/**
 * Extract relevant properties from a Mapbox feature
 * Preserves all useful metadata for admin tools
 */
function extractProperties(
  layerId: string,
  rawProps: Record<string, any>
): Record<string, any> {
  const props: Record<string, any> = {};

  // Always include class, type, and maki if present
  if (rawProps.class) props.class = rawProps.class;
  if (rawProps.type) props.type = rawProps.type;
  if (rawProps.maki) props.maki = rawProps.maki;
  if (rawProps.category_en) props.category = rawProps.category_en;

  // Road properties
  if (layerId.includes('road') || layerId.includes('highway')) {
    if (rawProps.ref) props.ref = rawProps.ref;
    if (rawProps.shield) props.shield = rawProps.shield;
    if (rawProps.network) props.network = rawProps.network;
    if (rawProps.oneway) props.oneway = rawProps.oneway;
    if (rawProps.structure) props.structure = rawProps.structure;
  }

  // Building properties
  if (layerId.includes('building')) {
    if (rawProps.height) props.height = rawProps.height;
    if (rawProps.min_height) props.min_height = rawProps.min_height;
    if (rawProps.extrude) props.extrude = rawProps.extrude;
    if (rawProps.underground) props.underground = rawProps.underground;
  }

  // Place properties
  if (layerId.includes('place')) {
    if (rawProps.capital) props.capital = rawProps.capital;
    if (rawProps.iso_3166_1) props.iso_code = rawProps.iso_3166_1;
    if (rawProps.iso_3166_2) props.iso_code_2 = rawProps.iso_3166_2;
  }

  // Water properties
  if (layerId.includes('water')) {
    if (rawProps.intermittent) props.intermittent = rawProps.intermittent;
  }

  // POI properties
  if (rawProps.address) props.address = rawProps.address;
  if (rawProps.phone) props.phone = rawProps.phone;
  if (rawProps.website) props.website = rawProps.website;
  if (rawProps.opening_hours) props.opening_hours = rawProps.opening_hours;
  if (rawProps.brand) props.brand = rawProps.brand;
  if (rawProps.operator) props.operator = rawProps.operator;
  if (rawProps.denomination) props.denomination = rawProps.denomination;
  if (rawProps.religion) props.religion = rawProps.religion;

  // Airport properties
  if (rawProps.iata) props.iata = rawProps.iata;
  if (rawProps.icao) props.icao = rawProps.icao;

  return props;
}

/**
 * Extract and categorize a Mapbox feature
 */
export function extractFeature(mapboxFeature: any): ExtractedFeature | null {
  if (!mapboxFeature) return null;

  const layerId = mapboxFeature.layer?.id || '';
  const sourceLayer = mapboxFeature.sourceLayer || null;
  const rawProps = mapboxFeature.properties || {};

  // Get name
  const name = rawProps.name || rawProps.name_en || null;

  // Determine category
  const category = determineCategory(layerId, rawProps);

  // Get config for this category
  const config = CATEGORY_CONFIG[category];

  // Extract relevant properties
  const properties = extractProperties(layerId, rawProps);

  // Build display label with type info if available
  let displayLabel = name
    ? `${name} · ${config.label}`
    : config.label;
  
  // Add type detail if different from category label
  if (properties.type && properties.type !== category) {
    displayLabel = name
      ? `${name} · ${config.label} (${properties.type})`
      : `${config.label} (${properties.type})`;
  }

  // Determine if this feature has useful data
  const hasUsefulData = !!(name || Object.keys(properties).length > 0 || category !== 'unknown');

  // Get atlas type
  const atlasType = getAtlasTypeFromCategory(category);
  
  // Determine intelligence flag - show for all buildings
  let showIntelligence = false;
  
  if (layerId.includes('building')) {
    // Show intelligence for all building types
    showIntelligence = true;
  } else if (category === 'house') {
    // If already categorized as 'house' (from POI or other detection), show intelligence
    showIntelligence = true;
  } else {
    // For other features, use category-based check
    showIntelligence = shouldShowIntelligence(category);
  }

  return {
    layerId,
    sourceLayer,
    name,
    category,
    icon: config.icon,
    label: config.label,
    properties,
    displayLabel,
    hasUsefulData,
    atlasType,
    showIntelligence,
  };
}

/**
 * Query and extract the best feature at a map point
 * Filters out custom layers (pins, atlas, etc.)
 */
export function queryFeatureAtPoint(
  map: any,
  point: { x: number; y: number }
): ExtractedFeature | null {
  if (!map || map.removed) return null;

  try {
    const features = map.queryRenderedFeatures(point);

    if (!features || features.length === 0) return null;

    // Find the first Mapbox base layer feature (not our custom layers)
    const mapFeature = features.find((f: any) => {
      const layerId = f.layer?.id || '';
      const source = f.source || '';

      // Skip our custom layers
      if (source === 'map-pins' || source.startsWith('atlas-')) return false;
      if (layerId.includes('map-pins') || layerId.includes('atlas-')) return false;
      if (layerId.includes('pin') && !layerId.includes('spinning')) return false;

      return true;
    });

    if (!mapFeature) return null;

    return extractFeature(mapFeature);
  } catch (error) {
    console.debug('[FeatureService] Error querying features:', error);
    return null;
  }
}

/**
 * Get action buttons appropriate for a feature category
 */
export function getFeatureActions(feature: ExtractedFeature): Array<{
  id: string;
  label: string;
  icon: string;
}> {
  const actions: Array<{ id: string; label: string; icon: string }> = [];

  // Add intelligence action for houses
  if (feature.showIntelligence) {
    actions.push({ id: 'intelligence', label: 'Property Intelligence', icon: '🧠' });
  }

  switch (feature.category) {
    case 'city':
      actions.push({ id: 'explore-city', label: 'Explore City', icon: '🔍' });
      break;
    case 'park':
      actions.push({ id: 'park-info', label: 'Park Info', icon: '🌳' });
      break;
    case 'school':
      actions.push({ id: 'school-info', label: 'School Info', icon: '🏫' });
      break;
    case 'lake':
      actions.push({ id: 'lake-info', label: 'Lake Info', icon: '💧' });
      break;
    case 'hospital':
      actions.push({ id: 'hospital-info', label: 'Hospital Info', icon: '🏥' });
      break;
    case 'church':
      actions.push({ id: 'church-info', label: 'Church Info', icon: '⛪' });
      break;
    case 'airport':
      actions.push({ id: 'airport-info', label: 'Airport Info', icon: '✈️' });
      break;
  }

  return actions;
}

/**
 * Clear the category cache (useful for testing or memory management)
 */
export function clearCategoryCache(): void {
  categoryCache.clear();
}

// Re-export helpers from categories
export { getAtlasTypeFromCategory, shouldShowIntelligence };
