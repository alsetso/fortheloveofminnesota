/**
 * ctuFloorZoomStore — module singleton holding the computed min-zoom floor
 * for the user's current CTU (city/township/unorganized territory).
 *
 * Set once on map load or whenever the CTU changes.
 * Read by useTerritoryFocusCamera so clearTerritoryCameraLock restores to
 * the CTU floor, not the global MAP_CONFIG.MIN_ZOOM.
 */

let _zoom: number | null = null;

export function getCtuFloorZoom(): number | null {
  return _zoom;
}

export function setCtuFloorZoom(zoom: number | null): void {
  _zoom = zoom;
}
