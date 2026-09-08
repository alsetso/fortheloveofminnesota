import type { Feature, FeatureCollection, Point } from 'geojson';
import type { DirectoryPageDetail, DirectoryPagePin } from '@/lib/directory/directoryPageTypes';

/** Convert API pages → Mapbox GeoJSON (Point features, promoteId = id). */
export function directoryPagesToFeatureCollection(
  pages: DirectoryPagePin[],
): FeatureCollection {
  const features: Feature<Point>[] = [];
  for (const page of pages) {
    if (!Number.isFinite(page.lat) || !Number.isFinite(page.lng)) continue;
    features.push({
      type: 'Feature',
      id: page.id,
      geometry: {
        type: 'Point',
        coordinates: [page.lng, page.lat],
      },
      properties: {
        id: page.id,
        slug: page.slug,
        name: page.title,
        title: page.title,
        page_type: page.pageType,
        page_type_label: page.pageTypeLabel,
        description: page.description,
        address: page.addressLine,
        website: page.website,
        logo_url: page.logoUrl,
        icon: page.icon,
        cover_url: page.coverUrl,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export async function fetchDirectoryPages(
  signal?: AbortSignal,
): Promise<DirectoryPagePin[]> {
  const res = await fetch('/api/directory/pages', {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    throw new Error('Failed to load directory pages');
  }
  const json = (await res.json()) as { pages?: DirectoryPagePin[]; error?: string };
  if (json.error) throw new Error(json.error);
  return json.pages ?? [];
}

export async function fetchDirectoryPageDetail(
  id: string,
  signal?: AbortSignal,
): Promise<DirectoryPageDetail | null> {
  const res = await fetch(`/api/directory/pages/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error('Failed to load page');
  }
  const json = (await res.json()) as {
    page?: DirectoryPageDetail;
    error?: string;
  };
  if (json.error) throw new Error(json.error);
  return json.page ?? null;
}

/** Primary listing fields for PATCH /api/directory/pages/[id]. */
export type DirectoryPagePatch = {
  title?: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  addressLine?: string | null;
  lat?: number | null;
  lng?: number | null;
  homeBased?: boolean;
  clearLocation?: boolean;
  pageType?: string;
  categoryId?: string | null;
  status?: 'draft' | 'active';
  visibility?: 'public' | 'unlisted';
};

export async function patchDirectoryPage(
  id: string,
  body: DirectoryPagePatch,
): Promise<{ id: string; slug: string }> {
  const res = await fetch(`/api/directory/pages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    id?: string;
    slug?: string;
    error?: string;
  };
  if (!res.ok || !json.id || !json.slug) {
    throw new Error(json.error ?? 'Failed to save page');
  }
  return { id: json.id, slug: json.slug };
}

export async function setDirectoryPageMedia(
  id: string,
  role: 'logo' | 'cover',
  url: string,
): Promise<{ url: string }> {
  const res = await fetch(`/api/directory/pages/${encodeURIComponent(id)}/media`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, url }),
  });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error ?? 'Failed to save media');
  }
  return { url: json.url };
}

export async function clearDirectoryPageMedia(
  id: string,
  role: 'logo' | 'cover',
): Promise<void> {
  const res = await fetch(
    `/api/directory/pages/${encodeURIComponent(id)}/media?role=${role}`,
    { method: 'DELETE', credentials: 'include' },
  );
  const json = (await res.json()) as { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to clear media');
  }
}

export async function deleteDirectoryPage(
  id: string,
  confirmTitle: string,
): Promise<void> {
  const res = await fetch(`/api/directory/pages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmTitle }),
  });
  const json = (await res.json()) as { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to delete page');
  }
}
