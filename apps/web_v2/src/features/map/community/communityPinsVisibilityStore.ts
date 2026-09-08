'use client';

import { useSyncExternalStore } from 'react';

/**
 * Two independent map-layer toggles:
 * - "Your pins" — only pins the signed-in account has posted.
 * - "All community pins" — every public pin (everyone, including you).
 * Combined helpers below preserve the old single-toggle API for call sites
 * that only care whether the pins layer is showing anything at all.
 */
let yourPinsOn = false;
let allPinsOn = true;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setYourPinsVisible(on: boolean): void {
  if (yourPinsOn === on) return;
  yourPinsOn = on;
  emit();
}

export function toggleYourPinsVisible(): void {
  setYourPinsVisible(!yourPinsOn);
}

/** Show only pins the signed-in account has posted. */
export function useYourPinsVisible(): boolean {
  return useSyncExternalStore(subscribe, () => yourPinsOn, () => false);
}

export function setAllCommunityPinsVisible(on: boolean): void {
  if (allPinsOn === on) return;
  allPinsOn = on;
  emit();
}

export function toggleAllCommunityPinsVisible(): void {
  setAllCommunityPinsVisible(!allPinsOn);
}

/** Show every public community pin (everyone, including you). */
export function useAllCommunityPinsVisible(): boolean {
  return useSyncExternalStore(subscribe, () => allPinsOn, () => true);
}

/**
 * Combined "is the pins layer showing anything" flag — Controls badge count,
 * rail dot, and map-interaction gating only care whether either toggle is on.
 */
export function useCommunityPinsVisible(): boolean {
  return useSyncExternalStore(subscribe, () => yourPinsOn || allPinsOn, () => true);
}
