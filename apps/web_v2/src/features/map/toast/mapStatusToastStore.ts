/**
 * Ephemeral map status rows (Find Me, map click, search, etc.) merged into MapLayerLoadToast.
 * Module store so location + territory UI can share one glass toast without a new provider.
 */

export type MapStatusRowStatus = 'loading' | 'success' | 'error';

export type MapStatusRow = {
  id: string;
  label: string;
  nested?: boolean;
  status: MapStatusRowStatus;
  detail?: string | null;
};

export type MapStatusToastSnapshot = {
  rows: MapStatusRow[];
  title: string | null;
};

type Listener = () => void;

const FIND_ME_TOAST_ID = 'find-me';
const MAP_CLICK_TOAST_ID = 'map-click';
const MAP_SEARCH_TOAST_ID = 'map-search';

let rows: MapStatusRow[] = [];
let title: string | null = null;
/** Cached snapshot — must be referentially stable for useSyncExternalStore. */
let snapshot: MapStatusToastSnapshot = { rows, title };
const listeners = new Set<Listener>();
const lingerTimers = new Map<string, number>();

function emit() {
  snapshot = { rows, title };
  for (const listener of listeners) listener();
}

function clearLinger(id: string) {
  const t = lingerTimers.get(id);
  if (t != null) {
    window.clearTimeout(t);
    lingerTimers.delete(id);
  }
}

export function getMapStatusToastSnapshot(): MapStatusToastSnapshot {
  return snapshot;
}

export function subscribeMapStatusToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishMapStatus(
  row: MapStatusRow,
  opts?: { title?: string | null; lingerMs?: number },
): void {
  clearLinger(row.id);
  const idx = rows.findIndex((r) => r.id === row.id);
  rows = idx >= 0 ? rows.map((r, i) => (i === idx ? row : r)) : [...rows, row];
  if (opts && 'title' in opts) {
    title = opts.title ?? null;
  }
  emit();

  const terminal = row.status === 'success' || row.status === 'error';
  if (terminal && opts?.lingerMs != null && opts.lingerMs > 0) {
    const timer = window.setTimeout(() => {
      lingerTimers.delete(row.id);
      clearMapStatusToast(row.id);
    }, opts.lingerMs);
    lingerTimers.set(row.id, timer);
  }
}

export function clearMapStatusToast(id?: string): void {
  if (id) {
    clearLinger(id);
    for (const key of [...lingerTimers.keys()]) {
      if (key.startsWith(`${id}:`)) clearLinger(key);
    }
    const next = rows.filter((r) => r.id !== id && !r.id.startsWith(`${id}:`));
    if (next.length === rows.length) return;
    rows = next;
    if (rows.length === 0) title = null;
    emit();
    return;
  }

  for (const key of lingerTimers.keys()) clearLinger(key);
  rows = [];
  title = null;
  emit();
}

/** Nested trailing row ids under a map-point toast (address / territories). */
export function mapStatusChildId(parentId: string, child: 'address' | 'territories'): string {
  return `${parentId}:${child}`;
}

export const MAP_STATUS_TOAST_IDS = {
  findMe: FIND_ME_TOAST_ID,
  mapClick: MAP_CLICK_TOAST_ID,
  mapSearch: MAP_SEARCH_TOAST_ID,
} as const;

/** Default linger for terminal map status toasts. */
export const MAP_STATUS_SUCCESS_LINGER_MS = 1600;
export const MAP_STATUS_ERROR_LINGER_MS = 2800;
