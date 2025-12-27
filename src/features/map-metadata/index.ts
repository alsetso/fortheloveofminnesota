// Services
export {
  extractFeature,
  queryFeatureAtPoint,
  determineCategory,
  getFeatureActions,
  clearCategoryCache,
  getAtlasTypeFromCategory,
  shouldShowIntelligence,
  type ExtractedFeature,
} from './services/featureService';

// Constants
export {
  type FeatureCategory,
  CATEGORY_CONFIG,
  ROAD_CATEGORIES,
  PLACE_CATEGORIES,
  LANDUSE_CATEGORIES,
  WATER_CATEGORIES,
  BUILDING_CATEGORIES,
  POI_CATEGORIES,
  POI_TYPE_CATEGORIES,
  MAKI_CATEGORIES,
} from './constants/categories';

// Hooks
export { useFeatureTracking } from './hooks/useFeatureTracking';

// Components
export { default as CursorTracker } from './components/CursorTracker';
export { default as FeatureCard } from './components/FeatureCard';





