/**
 * Recently opened dock records (territories / places) — MRU chip strip on Explore.
 * Session-scoped; recorded from openDetails.
 */

import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';

export const RECENT_DOCK_ENTITIES_STORAGE_KEY = 'ftlomn:ios2:recent-dock-entities';
export const RECENT_DOCK_ENTITIES_MAX = 6;

type Listener = () => void;

type StoredEntity = Pick<DockEntity, 'id' | 'kind' | 'title'> &
  Partial<Pick<DockEntity, 'subtitle' | 'summary' | 'kindLabel'>>;

let tabs: DockEntity[] = [];
let snapshot: { tabs: DockEntity[] } = { tabs };
let hydrated = false;
const listeners = new Set<Listener>();

function emit() {
  snapshot = { tabs };
  for (const listener of listeners) listener();
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      RECENT_DOCK_ENTITIES_STORAGE_KEY,
      JSON.stringify(tabs),
    );
  } catch {
    /* storage unavailable */
  }
}

function isValidEntity(value: unknown): value is StoredEntity {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    row.id.trim().length > 0 &&
    typeof row.kind === 'string' &&
    row.kind.trim().length > 0 &&
    typeof row.title === 'string' &&
    row.title.trim().length > 0
  );
}

function toDockEntity(row: StoredEntity): DockEntity {
  return {
    id: row.id.trim(),
    kind: row.kind as DockEntity['kind'],
    title: row.title.trim(),
    subtitle: row.subtitle,
    summary: row.summary,
    kindLabel: row.kindLabel,
  };
}

/** Map/place records for chips — not pins or generic pages. */
export function isRecentDockChipEntity(entity: DockEntity): boolean {
  return entity.kind !== 'pin' && entity.kind !== 'page';
}

export function recentDockEntityTabId(entity: Pick<DockEntity, 'kind' | 'id'>): string {
  return `${entity.kind}:${entity.id}`;
}

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const parsed: unknown = JSON.parse(
      window.sessionStorage.getItem(RECENT_DOCK_ENTITIES_STORAGE_KEY) ?? '[]',
    );
    if (!Array.isArray(parsed)) return;
    tabs = parsed.filter(isValidEntity).map(toDockEntity).slice(0, RECENT_DOCK_ENTITIES_MAX);
    snapshot = { tabs };
  } catch {
    tabs = [];
    snapshot = { tabs };
  }
}

export function getRecentDockEntitiesSnapshot(): { tabs: DockEntity[] } {
  hydrate();
  return snapshot;
}

export function subscribeRecentDockEntities(listener: Listener): () => void {
  hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Push / refresh MRU entry when a record is opened in details. */
export function recordRecentDockEntity(entity: DockEntity): void {
  if (!isRecentDockChipEntity(entity)) return;
  hydrate();
  const next = toDockEntity(entity);
  const tabId = recentDockEntityTabId(next);
  const rest = tabs.filter((t) => recentDockEntityTabId(t) !== tabId);
  tabs = [next, ...rest].slice(0, RECENT_DOCK_ENTITIES_MAX);
  persist();
  emit();
}

export function dismissRecentDockEntity(tabId: string): void {
  hydrate();
  const next = tabs.filter((t) => recentDockEntityTabId(t) !== tabId);
  if (next.length === tabs.length) return;
  tabs = next;
  persist();
  emit();
}

export function clearRecentDockEntities(): void {
  hydrate();
  if (tabs.length === 0) return;
  tabs = [];
  persist();
  emit();
}
