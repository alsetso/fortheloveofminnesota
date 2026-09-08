/**
 * DockMode — the single derived answer to "what is the dock shell doing right
 * now?". Mirrors the map's `resolveMapInteractionMode` pattern: mode is a pure
 * function of state, never set directly. Components branch on this instead of
 * recombining `snap` × `dockCard` × sheet flags themselves.
 *
 * Note `browse` spans both half and full snaps — consumers that care about the
 * physical detent (e.g. rails hiding at full) still read `snap` alongside.
 */

import type { MapDockSnap } from '@/features/map/dockCore/shell/MapDockContext';

export type DockMode =
  /** Collapsed pill only — the map owns the screen. */
  | 'hidden'
  /** Quarter peek — chips / selected-point entry above the map. */
  | 'peek'
  /** Pane stack open at half/full — browse, search, details, tools. */
  | 'browse'
  /** A dock card popover owns the sheet (account, pin, page, …). */
  | 'card'
  /** A full-viewport sheet (Contacts, Create Post) covers dock + map. */
  | 'overlay';

export type DockModeInput = {
  snap: MapDockSnap;
  dockCardOpen: boolean;
  contactsSheetOpen: boolean;
  createPostSheetOpen: boolean;
};

export function resolveDockMode({
  snap,
  dockCardOpen,
  contactsSheetOpen,
  createPostSheetOpen,
}: DockModeInput): DockMode {
  if (contactsSheetOpen || createPostSheetOpen) return 'overlay';
  if (dockCardOpen) return 'card';
  if (snap === 'collapsed') return 'hidden';
  if (snap === 'quarter') return 'peek';
  return 'browse';
}
