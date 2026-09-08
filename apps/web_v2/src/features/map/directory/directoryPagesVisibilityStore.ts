'use client';

import { useSyncExternalStore } from 'react';

/** Pages are on by default — users can hide them from Controls. */
let pagesOn = true;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return pagesOn;
}

export function setDirectoryPagesVisible(on: boolean): void {
  if (pagesOn === on) return;
  pagesOn = on;
  emit();
}

export function toggleDirectoryPagesVisible(): void {
  setDirectoryPagesVisible(!pagesOn);
}

/** Directory pages layer on/off — Controls + hit policy. */
export function useDirectoryPagesVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
