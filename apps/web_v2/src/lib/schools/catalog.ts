import type { SchoolCatalogResponse } from '@/lib/schools/types';

/** Client fetch for `/api/discover/schools`. */
export async function fetchSchoolCatalog(params: {
  q?: string;
  offset?: number;
  limit?: number;
}): Promise<SchoolCatalogResponse> {
  const search = new URLSearchParams({
    offset: String(params.offset ?? 0),
    limit: String(params.limit ?? 25),
  });
  const q = params.q?.trim();
  if (q) search.set('q', q);

  const res = await fetch(`/api/discover/schools?${search}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Could not load schools.');
  return (await res.json()) as SchoolCatalogResponse;
}
