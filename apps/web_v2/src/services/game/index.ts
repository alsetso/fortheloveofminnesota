/**
 * Game services — orchestration layer between the Mapbox engine and game features.
 *
 * These are pure TypeScript classes/factories with no React dependencies.
 * Import from features/map/game/* for UI components and stores.
 *
 * Service                   Responsibility
 * ──────────────────────    ─────────────────────────────────────────────
 * TileViewportService       XYZ tile math + moveend subscription
 * PlacementStreamService    Tile-cache streaming, dedup, store sync
 * GameRenderService         Full render lifecycle: init / patch / teardown
 */

export type { TileId, TileChangeCallback } from './TileViewportService';
export {
  latLngToTile,
  tileToBbox,
  tileSetToBbox,
  getBoundsTiles,
  getViewportTiles,
  subscribeViewportTiles,
} from './TileViewportService';

export type { PlacementStreamService } from './PlacementStreamService';
export { createPlacementStreamService, STREAM_TILE_ZOOM } from './PlacementStreamService';


export type { GameRenderService } from './GameRenderService';
export {
  createGameRenderService,
  ensureLodCircleLayer,
  LOD_3D_MIN_ZOOM,
  WORLD_LOD_CIRCLE_LAYER_ID,
} from './GameRenderService';
