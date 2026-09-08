/**
 * Shared map time filter — rail button + Explore dock stay in sync.
 */

export type MapTimeFilterValue = '24h' | '7d' | 'all';

export const MAP_TIME_FILTER_OPTIONS = [
  { value: '24h' as const, label: '24h', title: 'Last 24 hours' },
  { value: '7d' as const, label: '7d', title: 'Last 7 days' },
  { value: 'all' as const, label: 'All', title: 'All time' },
];

type Snapshot = { value: MapTimeFilterValue };
type Listener = () => void;

let value: MapTimeFilterValue = 'all';
let snapshot: Snapshot = { value };
const listeners = new Set<Listener>();

function emit() {
  snapshot = { value };
  for (const listener of listeners) listener();
}

export function getMapTimeFilterSnapshot(): Snapshot {
  return snapshot;
}

export function subscribeMapTimeFilter(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setMapTimeFilter(next: MapTimeFilterValue): void {
  if (next === value) return;
  value = next;
  emit();
}

export function cycleMapTimeFilter(): MapTimeFilterValue {
  const idx = MAP_TIME_FILTER_OPTIONS.findIndex((o) => o.value === value);
  const next = MAP_TIME_FILTER_OPTIONS[(idx + 1) % MAP_TIME_FILTER_OPTIONS.length]!.value;
  setMapTimeFilter(next);
  return next;
}

export function mapTimeFilterMeta(v: MapTimeFilterValue = value) {
  return MAP_TIME_FILTER_OPTIONS.find((o) => o.value === v) ?? MAP_TIME_FILTER_OPTIONS[2]!;
}
