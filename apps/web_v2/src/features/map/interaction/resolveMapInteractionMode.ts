import type { DockCardId } from '@/features/map/dockCore/dockCard/dockCardTypes';
import type { DockMode } from '@/features/map/dockCore/core/dockMode';
import type { DockPaneId } from '@/features/map/dockCore/core/dockPanes';
import type { MapInteractionMode } from '@/features/map/interaction/mapInteractionMode';

/**
 * Observable ownership inputs — derive mode; never set mode from feature code.
 *
 * `dockMode` is the shell's derived mode (hidden | peek | browse | card |
 * overlay). Feature-specific fields refine within that mode so the two systems
 * compose instead of overlapping.
 *
 * Priority (highest wins):
 * 1. compose  — Create Post overlay / selected-point (explicit place)
 * 2. route    — Your route pane
 * 3. locate   — Find Me location sharing
 * 4. mentions — Pin card
 * 5. explore  — Controls card OR any boundary layer painted
 * 6. browse   — empty map; miss may drop a point
 */
export type MapInteractionOwnership = {
  /** Derived dock shell mode — single answer for what owns the sheet. */
  dockMode: DockMode;
  /** Distinguishes Create Post vs Contacts when dockMode is `overlay`. */
  createPostOpen: boolean;
  paneId: DockPaneId;
  dockCard: DockCardId | null;
  /** User-toggled territory paint (not point-jurisdiction overlays). */
  boundariesOn: boolean;
  findMeSharing: boolean;
};

/** Pure resolve — single place for mode priority. Easy to unit-test. */
export function resolveMapInteractionMode(
  o: MapInteractionOwnership,
): MapInteractionMode {
  // Overlay: Create Post owns compose; Contacts (and other overlays) fall
  // through so miss-tap policy follows the pane underneath.
  if (o.dockMode === 'overlay' && o.createPostOpen) return 'compose';
  if (o.paneId === 'selected-point') return 'compose';
  if (o.paneId === 'your-route') return 'route';
  if (o.findMeSharing) return 'locate';
  if (o.dockMode === 'card' && o.dockCard === 'pin') return 'mentions';
  if (o.dockMode === 'card' && o.dockCard === 'controls') return 'explore';
  if (o.boundariesOn) return 'explore';
  return 'browse';
}

/** Capability gate — prefer this over checking mode strings in UI. */
export function canDropSelectedPoint(mode: MapInteractionMode): boolean {
  return mode === 'browse' || mode === 'compose' || mode === 'locate';
}

/** Capability gate — territory hit-test / hover popovers. */
export function canInspectTerritories(mode: MapInteractionMode): boolean {
  return mode !== 'mentions';
}

/** Capability gate — community pin hits. */
export function canInspectPins(mode: MapInteractionMode): boolean {
  return true;
}
