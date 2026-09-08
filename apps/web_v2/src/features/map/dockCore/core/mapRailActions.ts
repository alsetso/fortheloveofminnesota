/**
 * Map rail actions — SSOT for floating controls ↔ Explore dock.
 * Dock owner (pane.id) is separate from persistent sessions (e.g. Find Me GPS).
 */

import type { DockPane, DockPaneId } from '@/features/map/dockCore/core/dockPanes';

export type MapRailId =
  | 'saved'
  | 'layers'
  | 'map-style'
  | 'locate'
  | 'camera';

export type MapRailAction = {
  id: MapRailId;
  /** Dock pane this rail owns when open (omit for session-only rails like locate/camera). */
  paneId?: DockPaneId;
  label: string;
  /** Short dock row title. */
  dockTitle: string;
  /** Dock row subtitle. */
  dockSubtitle: string;
  /** Stay visible on the rail while another tool owns the dock (Find Me). */
  persistent?: boolean;
};

/**
 * Contact-book / map tool actions — rails are the open path for each.
 * Browse shows live Contact Book strips; full lists open via Saved rail paths.
 * 2D/3D tilt lives only on the floating rail (no dock pane).
 * Locate / camera are session overlays (no dock card).
 */
export const MAP_DOCK_RAIL_ACTIONS: MapRailAction[] = [
  {
    id: 'locate',
    label: 'Find me',
    dockTitle: 'Find me',
    dockSubtitle: 'Your location on the map',
    persistent: true,
  },
  {
    id: 'camera',
    label: 'Camera',
    dockTitle: 'Camera',
    dockSubtitle: 'Create a post with the in-app camera',
    persistent: true,
  },
  {
    id: 'layers',
    label: 'Map layers',
    dockTitle: 'Controls',
    dockSubtitle: 'Areas & personal layers',
    persistent: true,
  },
  {
    id: 'map-style',
    paneId: 'map-style',
    label: 'Map style',
    dockTitle: 'Map style',
    dockSubtitle: 'Streets, outdoors, satellite',
    persistent: true,
  },
  {
    id: 'saved',
    label: 'Saved',
    dockTitle: 'Saved',
    dockSubtitle: 'Your contact book',
    persistent: true,
  },
];

/** Right-rail tools (top → bottom: camera, world place, layers). */
export const MAP_RAIL_ACTIONS: MapRailAction[] = [
  MAP_DOCK_RAIL_ACTIONS.find((a) => a.id === 'camera')!,
  MAP_DOCK_RAIL_ACTIONS.find((a) => a.id === 'layers')!,
];

/** Panes that are "map tools" — opening one replaces another tool on the stack. */
export const MAP_TOOL_PANE_IDS: ReadonlySet<DockPaneId> = new Set([
  'map-style',
  'tools',
  'selected-point',
  'your-route',
]);

export function isMapToolPane(id: DockPaneId): boolean {
  return MAP_TOOL_PANE_IDS.has(id);
}

/** Rail whose pane currently owns the dock (if any). */
export function activeRailIdForPane(pane: DockPane | DockPaneId): MapRailId | null {
  if (typeof pane === 'string') {
    const match = MAP_DOCK_RAIL_ACTIONS.find((r) => r.paneId === pane);
    return match?.id ?? null;
  }
  if (pane.id === 'subpage' && pane.kind === 'saved') return 'saved';
  const match = MAP_DOCK_RAIL_ACTIONS.find((r) => r.paneId === pane.id);
  return match?.id ?? null;
}

/**
 * Soft quiet: only full snap hides rails. Tool panes keep rails visible so
 * Explore dock + rails stay connected with active states.
 */
export function shouldQuietNonPersistentRails(_paneId: DockPaneId): boolean {
  return false;
}
