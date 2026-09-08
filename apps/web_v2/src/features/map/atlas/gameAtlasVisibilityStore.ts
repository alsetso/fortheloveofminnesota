'use client';

import { useSyncExternalStore } from 'react';
import {
  GAME_ATLAS_COLLECTIONS,
  GAME_ATLAS_DEFAULT_SLUGS,
} from '@/features/map/atlas/gameAtlasCollections';

/** Enabled atlas collection slugs for the game map overlay. */
let enabled = new Set<string>(GAME_ATLAS_DEFAULT_SLUGS);
/** Cached snapshot — useSyncExternalStore requires referential stability. */
let snapshot = freezeSlugs(GAME_ATLAS_DEFAULT_SLUGS);
const listeners = new Set<() => void>();

function freezeSlugs(slugs: string[]): string[] {
  return GAME_ATLAS_COLLECTIONS.map((c) => c.slug).filter((slug) =>
    slugs.includes(slug),
  );
}

function rebuildSnapshot(): void {
  snapshot = freezeSlugs([...enabled]);
}

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string[] {
  return snapshot;
}

/** Server / SSR snapshot — no atlas overlays until client hydrates. */
const SERVER_SNAPSHOT: string[] = [];

function getServerSnapshot(): string[] {
  return SERVER_SNAPSHOT;
}

export function setGameAtlasCollectionEnabled(slug: string, on: boolean): void {
  const next = new Set(enabled);
  if (on) next.add(slug);
  else next.delete(slug);
  if (next.size === enabled.size && [...next].every((s) => enabled.has(s))) {
    return;
  }
  enabled = next;
  rebuildSnapshot();
  emit();
}

export function toggleGameAtlasCollection(slug: string): void {
  setGameAtlasCollectionEnabled(slug, !enabled.has(slug));
}

export function isGameAtlasCollectionEnabled(slug: string): boolean {
  return enabled.has(slug);
}

/** Active collection slugs for bbox streaming (stable order). */
export function useGameAtlasEnabledSlugs(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useGameAtlasCollectionOn(slug: string): boolean {
  const slugs = useGameAtlasEnabledSlugs();
  return slugs.includes(slug);
}
