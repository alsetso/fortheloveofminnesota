import type {
  DiscoverSearchPersistInput,
  DiscoverSearchResponse,
} from '@/lib/discover/search/types';

export type {
  DiscoverSearchHit,
  DiscoverSearchPersistInput,
  DiscoverSearchRecentRow,
  DiscoverSearchResponse,
  DiscoverSearchSection,
} from '@/lib/discover/search/types';
export { DISCOVER_SEARCH_MIN_QUERY } from '@/lib/discover/search/types';

export async function fetchDiscoverSearch(
  q: string,
  signal?: AbortSignal,
): Promise<DiscoverSearchResponse> {
  const params = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed) params.set('q', trimmed);

  const res = await fetch(`/api/discover/search?${params}`, {
    credentials: 'include',
    cache: 'no-store',
    signal,
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Search failed');
  }
  return (await res.json()) as DiscoverSearchResponse;
}

export async function persistDiscoverSearchCompletion(
  input: DiscoverSearchPersistInput,
): Promise<void> {
  const trimmed = input.query.trim();
  if (trimmed.length < 2) return;
  await fetch('/api/discover/search', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      query: trimmed,
    }),
  }).catch(() => undefined);
}

/** @deprecated Prefer persistDiscoverSearchCompletion with hit metadata. */
export async function persistDiscoverSearchClick(query: string): Promise<void> {
  await persistDiscoverSearchCompletion({
    query,
    completedVia: 'submit',
  });
}
