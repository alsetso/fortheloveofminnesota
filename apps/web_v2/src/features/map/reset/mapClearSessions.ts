/**
 * Store-level map clears — no React. Compose via `useMapReset` for UI.
 * Mode stays derived: clear ownership inputs; never `setMapInteractionMode('browse')`.
 */

import { clearActiveRoute } from '@/features/map/dockCore/store/activeRouteStore';
import { clearPointTerritoryOverlays } from '@/features/map/territory/pointTerritoryOverlays';
import { setTerritoriesAroundMeOn } from '@/features/map/territory/territoriesAroundMeStore';
import { clearTerritorySelection } from '@/features/map/territory/territorySelection';
import { clearRouteGeometry } from '@/lib/geo/nearby/routeLineStore';
import { clearSelectedPointCoords } from '@/map/location/camera/selectedPointCoordsStore';
import { clearWorldPlacements } from '@/features/map/game/world';

/** Drop the selected-point marker + coords (pane leave is dock-side). */
export function clearSelectedPointSession(): void {
  clearSelectedPointCoords();
}

/** Drop route line + session. */
export function clearRouteSession(): void {
  clearRouteGeometry();
  clearActiveRoute();
}

/** Drop selection highlight layer (feature-state cleared when selectedEntity nulls). */
export function clearTerritorySelectionHighlight(): void {
  clearTerritorySelection();
}

/**
 * Map-paint half of clear-select (territory outline).
 * Dock entity / feature-state are cleared by `clearMapSelection` + the click handler.
 */
export function clearMapSelectSession(): void {
  clearTerritorySelectionHighlight();
}

/** Drop at-point jurisdiction paint from compose / Where I'm at. */
export function clearPointJurisdictionPaint(): void {
  setTerritoriesAroundMeOn(false);
  clearPointTerritoryOverlays();
}

/**
 * Tools session clear — route + selected point + point jurisdictions.
 * Does NOT touch boundary layers or Find Me (Follow Me stays locked until stopFindMe).
 */
export function clearMapToolPaint(): void {
  clearRouteSession();
  clearSelectedPointSession();
  clearPointJurisdictionPaint();
  clearTerritorySelectionHighlight();
  clearWorldPlacements();
}
