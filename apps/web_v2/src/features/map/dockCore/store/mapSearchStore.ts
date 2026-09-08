'use client';

import { useSyncExternalStore } from 'react';

/**
 * Universal map search query — its own tiny store, not a field on the giant
 * dock context. Explore's search pill/pane read and write it directly;
 * nothing else needs to be re-rendered when it changes, and the dock
 * context only has to clear it (not own it) when leaving search.
 */
let query = '';
const listeners = new Set<() => void>();

export function getMapSearchQuery(): string {
  return query;
}

export function setMapSearchQuery(next: string): void {
  if (query === next) return;
  query = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMapSearchQuery(): string {
  return useSyncExternalStore(subscribe, getMapSearchQuery, () => '');
}
