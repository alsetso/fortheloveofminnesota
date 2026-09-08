/**
 * Object Radar — Game feature for nearby collectibles.
 *
 * Layers
 *   types / constants     data contracts
 *   objectRadarStore      shared state (range, mode, objects, selection)
 *   services/             load, paint, shared map engine, basemap darken
 *   layers/               Mapbox sources + paint
 *   data/                 in-range filters + counts
 *   ui/                   ObjectMiniMap, ObjectMap, controls
 *
 * Surfaces (ONE Mapbox instance — relocated between dial + sheet)
 *   ObjectMiniMap  round peek — dock left-rail slot (GameMinimapRail)
 *   MinimapsShell  full sheet — Objects / Unlocked / Records
 *   ObjectMap      Objects pane — edits Range, Still out / Collected
 *   Range          meters from player origin
 */

export { ObjectRadar, OBJECT_RADAR_MAP_STYLE } from './ObjectRadar';
export { ObjectMiniMap } from './ui/ObjectMiniMap';
export { ObjectMap } from './ui/ObjectMap';
export { MinimapsShell } from '@/features/map/game/minimaps/MinimapsShell';
export {
  objectRadarActions,
  useObjectRadarStore,
  hydrateObjectRadarStore,
} from './objectRadarStore';
export {
  OBJECT_RADAR_DEFAULT_RANGE_M,
  OBJECT_RADAR_MINIMAP_SIZE_PX,
} from './constants';
export { clampRangeM, fitCameraToRange, formatRangeM } from './range';
export {
  OBJECT_RADAR_LEGEND,
  OBJECT_RADAR_SLUGS,
  type ObjectRadarMode,
  type ObjectRadarSlug,
  type ObjectRadarSurface,
  type ObjectRadarFeatureProps,
} from './types';
