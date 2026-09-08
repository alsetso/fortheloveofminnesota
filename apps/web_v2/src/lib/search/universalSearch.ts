/** Client for GET /api/search/universal — free MN directory fan-out. */

export type UniversalPlaceHit = {
  source: 'place';
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
};

export type UniversalTerritoryHit = {
  source: 'territory';
  id: string;
  kind: string;
  slug: string;
  title: string;
  subtitle: string | null;
  kindLabel: string;
};

export type UniversalAccountHit = {
  source: 'account';
  id: string;
  title: string;
  subtitle: string | null;
  username: string | null;
  imageUrl: string | null;
};

export type UniversalRecentRow = {
  id: string;
  query: string;
  createdAt: string;
  hitSummary: {
    placeCount?: number;
    territoryCount?: number;
    accountCount?: number;
  };
};

export type UniversalSearchResult = {
  query: string;
  origin: 'universal_search';
  places: UniversalPlaceHit[];
  territories: UniversalTerritoryHit[];
  accounts: UniversalAccountHit[];
  recent: UniversalRecentRow[];
};

export async function universalSearch(
  query: string,
  signal?: AbortSignal,
): Promise<UniversalSearchResult> {
  const q = query.trim();
  const params = new URLSearchParams();
  if (q) params.set('q', q);

  const res = await fetch(`/api/search/universal?${params}`, {
    signal,
    cache: 'no-store',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Search failed');
  }

  const data = (await res.json()) as Omit<UniversalSearchResult, 'recent'> & {
    recent?: UniversalRecentRow[];
  };

  return {
    query: data.query ?? q,
    origin: 'universal_search',
    places: data.places ?? [],
    territories: data.territories ?? [],
    accounts: data.accounts ?? [],
    recent: data.recent ?? [],
  };
}

export function formatUniversalRecentSubtitle(row: UniversalRecentRow): string {
  const parts: string[] = [];
  const s = row.hitSummary;
  if (s.placeCount) parts.push(`${s.placeCount} place${s.placeCount === 1 ? '' : 's'}`);
  if (s.territoryCount) {
    parts.push(`${s.territoryCount} territor${s.territoryCount === 1 ? 'y' : 'ies'}`);
  }
  if (s.accountCount) {
    parts.push(`${s.accountCount} ${s.accountCount === 1 ? 'person' : 'people'}`);
  }
  return parts.length ? parts.join(' · ') : 'Universal search';
}

/**
 * Record a Recent activity row for the result the user opened.
 * Fire-and-forget — search typing never writes; only clicks do.
 */
export function recordUniversalSearchClick(input: {
  title: string;
  source: 'place' | 'territory' | 'account';
}): void {
  const query = input.title.trim();
  if (query.length < 2) return;
  void fetch('/api/search/universal', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, source: input.source }),
  }).catch(() => {
    /* ignore */
  });
}
