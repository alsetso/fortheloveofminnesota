/**
 * Shared Discover omnibox query — shell TopBar + DiscoverPage stay in sync
 * while the lightbox is open over the map.
 */

type Listener = () => void;

let query = '';
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getDiscoverSearchQuery(): string {
  return query;
}

export function setDiscoverSearchQuery(next: string): void {
  if (query === next) return;
  query = next;
  emit();
}

export function clearDiscoverSearchQuery(): void {
  setDiscoverSearchQuery('');
}

export function subscribeDiscoverSearchQuery(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
