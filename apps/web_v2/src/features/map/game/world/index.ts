/**
 * World 3D models + placement system.
 * Catalog (Supabase) → rail place mode → map layers → persist via /api/world/placements.
 */

export { WorldModelsLayer } from '@/features/map/game/world/WorldModelsLayer';
export {
  WorldModelKindIcon,
  WorldPlaceRailIcon,
} from '@/features/map/game/world/WorldPlaceRailIcon';
export { useWorldPlaceMode } from '@/features/map/game/world/useWorldPlaceMode';
export { useWorldCatalog } from '@/features/map/game/world/useWorldCatalog';
export type { WorldPlaceMode } from '@/features/map/game/world/placeModeStore';
export type {
  WorldModelSlug,
  WorldModelSpec,
} from '@/features/map/game/world/catalog';
export {
  WORLD_MODEL_CATALOG,
  WORLD_MODEL_KINDS,
  WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID,
  WORLD_PLACEMENT_HIT_LAYER_ID,
  WORLD_PLACEMENT_PULSE,
  WORLD_PLACEMENTS_SOURCE_ID,
  FALLBACK_WORLD_MODELS,
  isWorldModelKind,
  worldModelKindForSlug,
  worldModelLayerId,
  resolveWorldModelUrl,
} from '@/features/map/game/world/catalog';
export {
  getWorldCatalog,
  getWorldCatalogSlugs,
  getWorldModel,
  getPlaceableWorldCatalog,
  setWorldCatalog,
  subscribeWorldCatalog,
} from '@/features/map/game/world/catalogStore';
export { loadWorldCatalog } from '@/features/map/game/world/catalogPersist';
export { loadElementTypes } from '@/features/map/game/world/elementTypesPersist';
export type { ElementType } from '@/features/map/game/world/elementTypes';
export {
  ELEMENT_TYPE_FALLBACKS,
  COLLECTIBLE_COLOR,
  COLLECTIBLE_RARE_COLOR,
  buildColorMap,
  categoryColor,
} from '@/features/map/game/world/elementTypes';
export {
  getElementTypes,
  getElementTypeColorMap,
  setElementTypes,
  subscribeElementTypes,
} from '@/features/map/game/world/elementTypesStore';
export {
  getWorldPlaceMode,
  isWorldPlaceModeActive,
  setWorldPlaceMode,
  cycleWorldPlaceMode,
  peekNextWorldPlaceMode,
  subscribeWorldPlaceMode,
} from '@/features/map/game/world/placeModeStore';
export {
  DEMO_WORLD_PLACEMENT_PREFIX,
  addWorldPlacement,
  clearDemoWorldPlacements,
  clearWorldPlacements,
  getWorldPlacementsSnapshot,
  isDemoWorldPlacementId,
  rebuildWorldPlacementFeatures,
  setWorldPlacements,
  subscribeWorldPlacements,
} from '@/features/map/game/world/placementsStore';
export {
  loadWorldPlacements,
  placeWorldModel,
} from '@/features/map/game/world/placementsPersist';
export {
  PLACEMENT_TOTAL_BUDGET,
  PLACEMENT_SLUG_BUDGETS,
  PLACEMENT_TIER_A_RADIUS_M,
  PLACEMENT_TIER_B_RADIUS_M,
  PLACEMENT_MOVE_REFRESH_THRESHOLD_M,
} from '@/features/map/game/world/placementBudget';
export {
  haversineMeters,
  annotateDistance,
  prioritizePlacements,
} from '@/features/map/game/world/placementPriority';
export type { PrioritizablePoint } from '@/features/map/game/world/placementPriority';
export { resolvePlacementPose } from '@/features/map/game/world/resolvePlacementPose';
export {
  BLOCK_GRID_METERS,
  BLOCK_MODEL_CATEGORY,
  BLOCKS_PER_ANCHOR_TILE,
  EARTH_CIRCUMFERENCE_M,
  EARTH_RADIUS_M,
  GRID_ANCHOR_LAT_DEG,
  GRID_ANCHOR_ZOOM,
  TILE_METERS_AT_ANCHOR,
  BLOCK_GRID_DEBUG_LAYER_ID,
  BLOCK_GRID_DEBUG_SOURCE_ID,
  blockCellKey,
  buildBlockGridGeoJSON,
  cellKeyToLatLng,
  latLngToCellKey,
  maybeSnapToGrid,
  parseBlockCellKey,
  snapToBlockGrid,
} from '@/features/map/game/world/worldGrid';
export type { GridCell, SnappedCoords } from '@/features/map/game/world/worldGrid';
export type {
  PoseModel,
  PosePlacement,
  ResolvedPose,
} from '@/features/map/game/world/resolvePlacementPose';
export {
  queryWorldPlacementAtPoint,
  setWorldPlacementFeatureState,
  WORLD_PLACEMENT_COLLECT_RADIUS_PX,
} from '@/features/map/game/world/placementHitTest';
export type { WorldPlacementHit } from '@/features/map/game/world/placementHitTest';
export {
  PLACEMENT_FOUND_COPY,
  placementFoundCopy,
} from '@/features/map/game/world/placementFoundCopy';
export {
  openWorldPlacementFound,
  closeWorldPlacementFound,
} from '@/features/map/game/world/placementFoundStore';
