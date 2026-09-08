/**
 * Zone out-of-bounds modal store.
 *
 * Fires when the user attempts to drop a selected-point pin outside the active
 * experience zone while Explore Zone is on. The modal presents two actions:
 *   - "Leave Zone" — exits Explore Zone and lets the pin drop proceed.
 *   - "Cancel"    — dismisses and keeps Explore Zone active.
 */

import { useSyncExternalStore } from 'react';

export type ZoneOutOfBoundsState = {
  open: boolean;
  zoneName: string | null;
  /** Callback to run if the user confirms "Leave Zone". */
  onLeave: (() => void) | null;
};

const CLOSED: ZoneOutOfBoundsState = { open: false, zoneName: null, onLeave: null };

let state: ZoneOutOfBoundsState = CLOSED;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function getZoneOutOfBoundsState(): ZoneOutOfBoundsState {
  return state;
}

export function subscribeZoneOutOfBounds(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useZoneOutOfBounds(): ZoneOutOfBoundsState {
  return useSyncExternalStore(
    subscribeZoneOutOfBounds,
    getZoneOutOfBoundsState,
    getZoneOutOfBoundsState,
  );
}

export function showZoneOutOfBounds(zoneName: string, onLeave: () => void): void {
  state = { open: true, zoneName, onLeave };
  notify();
}

export function closeZoneOutOfBounds(): void {
  if (!state.open) return;
  state = CLOSED;
  notify();
}
