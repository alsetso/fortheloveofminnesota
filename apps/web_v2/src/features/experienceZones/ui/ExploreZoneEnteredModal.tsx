'use client';

/**
 * Confirm modal after Yes — map is now in Explore Zone mode.
 */

import { useSyncExternalStore } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import { objectRadarActions } from '@/features/map/game/objectRadar/objectRadarStore';
import { haptic } from '@/lib/despia/haptics';

export type ExploreZoneEnteredState = {
  zoneId: string;
  zoneName: string;
  objectCount: number | null;
};

let snapshot: ExploreZoneEnteredState | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function getExploreZoneEnteredState(): ExploreZoneEnteredState | null {
  return snapshot;
}

export function subscribeExploreZoneEntered(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openExploreZoneEntered(next: ExploreZoneEnteredState): void {
  snapshot = next;
  emit();
}

export function closeExploreZoneEntered(): void {
  if (!snapshot) return;
  snapshot = null;
  emit();
}

export function ExploreZoneEnteredModal() {
  const state = useSyncExternalStore(
    subscribeExploreZoneEntered,
    getExploreZoneEnteredState,
    () => null,
  );

  if (!state) return null;

  const countLabel =
    state.objectCount == null
      ? null
      : state.objectCount === 1
        ? '1 object in this zone'
        : `${state.objectCount} objects in this zone`;

  const handleClose = () => {
    haptic.toggle();
    closeExploreZoneEntered();
    objectRadarActions.openSheet();
  };

  return (
    <DialogBackdrop
      onClose={handleClose}
      dimClassName="bg-black/50"
      className="px-5"
      ariaLabel={`Exploring ${state.zoneName}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="explore-zone-entered-title"
        aria-describedby="explore-zone-entered-body"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-white text-center shadow-xl"
      >
        <div className="px-5 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5C6670]">
            Experience zone
          </p>
          <h2
            id="explore-zone-entered-title"
            className="mt-2 text-[20px] font-bold tracking-tight text-[#1C1C1E]"
          >
            {state.zoneName}
          </h2>
          <p
            id="explore-zone-entered-body"
            className="mt-2 text-[14px] leading-snug text-[#5C6670]"
          >
            Your map is now in this experience zone.
            {countLabel ? ` ${countLabel}.` : ''}
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-5 w-full rounded-full bg-green-600 px-4 py-2.5 text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.35)] transition active:scale-95 hover:bg-green-500"
          >
            Let&apos;s go
          </button>
        </div>
      </div>
    </DialogBackdrop>
  );
}
