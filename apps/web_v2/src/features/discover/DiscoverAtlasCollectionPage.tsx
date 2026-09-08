'use client';

/**
 * `/discover/atlas/[slug]` — about + map preview + feature list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import {
  DiscoverAtlasCollectionMap,
  type AtlasMapSelect,
} from '@/features/discover/DiscoverAtlasCollectionMap';
import { FeedSearchField } from '@/features/feed/FeedSearchField';
import { IconArrowLeft, IconMapPin } from '@/features/map/dockCore/core/icons';
import { safePadTop } from '@/lib/despia/safeArea';
import {
  atlasFeatureLabel,
  atlasVisibilityLabel,
  type AtlasCollectionVisibility,
  type AtlasFeatureListRow,
  type AtlasFilterKind,
  type AtlasGeomType,
} from '@/lib/atlas/types';
import { DISCOVER_ATLAS_PATH, GAME_PATH } from '@/lib/routes/routePolicy';
import { queuePendingMapFocus } from '@/map/location/camera/pendingMapFocus';

const PAGE_SIZE = 40;
const SEARCH_DEBOUNCE_MS = 280;

type CollectionMeta = {
  slug: string;
  name: string;
  description: string | null;
  filterKind: AtlasFilterKind | string;
  visibility: AtlasCollectionVisibility | string;
  sourceLabel: string | null;
  geomModes?: AtlasGeomType[];
};

type ListResponse = {
  collection: CollectionMeta;
  rows: AtlasFeatureListRow[];
  total: number;
  offset: number;
  limit: number;
};

type ListState = {
  collection: CollectionMeta | null;
  rows: AtlasFeatureListRow[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

const EMPTY: ListState = {
  collection: null,
  rows: [],
  total: 0,
  hasMore: true,
  loading: false,
  error: null,
};

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name?: string }).name === 'AbortError')
  );
}

function geomModesLabel(modes: AtlasGeomType[] | undefined): string {
  if (!modes?.length) return 'Locations';
  const labels = modes.map((m) => {
    switch (m) {
      case 'point':
        return 'points';
      case 'line':
        return 'lines';
      case 'polygon':
        return 'polygons';
      default:
        return m;
    }
  });
  return labels.join(' · ');
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'park':
      return 'Parks';
    case 'bridge':
      return 'Bridges';
    case 'trail':
      return 'Trails';
    case 'lake':
      return 'Lakes';
    case 'landmark':
      return 'Landmarks';
    default:
      return 'Features';
  }
}

function useCollectionFeatures(slug: string, query: string) {
  const [state, setState] = useState<ListState>(EMPTY);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  const loadMore = useCallback(
    async (reset: boolean) => {
      if (!reset && (loadingRef.current || !hasMoreRef.current)) return;

      if (reset) {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        genRef.current += 1;
        offsetRef.current = 0;
        hasMoreRef.current = true;
        loadingRef.current = false;
      }

      const gen = genRef.current;
      const signal = abortRef.current?.signal;
      loadingRef.current = true;
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        ...(reset ? { rows: [], total: 0, hasMore: true } : null),
      }));

      try {
        const offset = reset ? 0 : offsetRef.current;
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(PAGE_SIZE),
        });
        const q = queryRef.current.trim();
        if (q) params.set('q', q);
        const res = await fetch(
          `/api/discover/atlas/${encodeURIComponent(slug)}?${params}`,
          { credentials: 'include', cache: 'no-store', signal },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? 'Failed to load');
        }
        const body = (await res.json()) as ListResponse;
        if (gen !== genRef.current) return;
        const nextRows = body.rows ?? [];
        const nextOffset = offset + nextRows.length;
        const more = nextOffset < (body.total ?? 0);
        offsetRef.current = nextOffset;
        hasMoreRef.current = more;
        setState((prev) => ({
          collection: body.collection ?? prev.collection,
          rows: reset ? nextRows : [...prev.rows, ...nextRows],
          total: body.total ?? nextRows.length,
          hasMore: more,
          loading: false,
          error: null,
        }));
      } catch (err) {
        if (isAbortError(err) || signal?.aborted || gen !== genRef.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load',
        }));
      } finally {
        if (gen === genRef.current) loadingRef.current = false;
      }
    },
    [slug],
  );

  useEffect(() => {
    void loadMore(true);
    return () => {
      abortRef.current?.abort();
    };
  }, [loadMore, query]);

  return { ...state, loadMore: () => void loadMore(false) };
}

export default function DiscoverAtlasCollectionPage({ slug }: { slug: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const list = useCollectionFeatures(slug, debouncedQuery);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && list.hasMore && !list.loading) {
          list.loadMore();
        }
      },
      { rootMargin: '200px', threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [list.hasMore, list.loading, list.loadMore]);

  const openAt = useCallback(
    (lat: number, lng: number, label: string) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      queuePendingMapFocus({ lat, lng, label });
      router.push(GAME_PATH);
    },
    [router],
  );

  const onOpen = useCallback(
    (row: AtlasFeatureListRow) => {
      const label = atlasFeatureLabel(row);
      if (
        typeof row.lat === 'number' &&
        typeof row.lng === 'number' &&
        Number.isFinite(row.lat) &&
        Number.isFinite(row.lng)
      ) {
        openAt(row.lat, row.lng, label);
        return;
      }
      router.push(GAME_PATH);
    },
    [openAt, router],
  );

  const onMapSelect = useCallback(
    (hit: AtlasMapSelect) => {
      openAt(hit.lat, hit.lng, hit.name);
    },
    [openAt],
  );

  const title = list.collection?.name ?? 'Feature set';
  const visibility = (list.collection?.visibility ?? 'statewide') as AtlasCollectionVisibility;
  const about =
    list.collection?.description?.trim() ||
    `${kindLabel(String(list.collection?.filterKind ?? 'other'))} across Minnesota.`;

  return (
    <PageScroll>
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
        style={{ paddingTop: safePadTop('0.2rem') }}
      >
        <div className="relative flex h-11 items-center px-3">
          <button
            type="button"
            onClick={() => router.push(DISCOVER_ATLAS_PATH)}
            aria-label="Back to Atlas"
            className="relative z-[1] inline-flex h-9 items-center gap-0.5 rounded-full px-1.5 text-lake-blue transition active:opacity-70"
          >
            <IconArrowLeft className="h-5 w-5" />
            <span className="text-[16px] font-semibold">Atlas</span>
          </button>
          <h1 className="pointer-events-none absolute inset-x-0 truncate px-24 text-center text-[17px] font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <div className="ml-auto w-[72px]" aria-hidden />
        </div>
        <div className="px-4 pb-2.5 pt-1">
          <FeedSearchField
            value={query}
            onChange={setQuery}
            onCancel={() => setQuery('')}
            placeholder={`Search ${title.toLowerCase()}`}
          />
        </div>
      </header>

      <div className="pb-12">
        <DiscoverAtlasCollectionMap
          slug={slug}
          label={kindLabel(String(list.collection?.filterKind ?? 'other')).toLowerCase()}
          onSelect={onMapSelect}
        />

        <section className="border-b border-black/[0.08] px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-muted">
            About this feature set
          </p>
          <h2 className="mt-1.5 text-[20px] font-bold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-foreground-muted">
            {about}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            <div>
              <dt className="text-foreground-muted">Coverage</dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                {atlasVisibilityLabel(visibility)}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Features</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
                {list.total > 0 ? list.total.toLocaleString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Geometry</dt>
              <dd className="mt-0.5 font-semibold capitalize text-foreground">
                {geomModesLabel(list.collection?.geomModes)}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Source</dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                {list.collection?.sourceLabel?.trim() || 'Atlas'}
              </dd>
            </div>
          </dl>
        </section>

        {list.error ? (
          <p className="px-5 pt-3 text-[14px] text-red-700">{list.error}</p>
        ) : null}

        <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
          <p className="text-[13px] font-semibold text-foreground">
            {debouncedQuery ? 'Matches' : 'All features'}
          </p>
          {list.total > 0 ? (
            <span className="shrink-0 text-[13px] tabular-nums text-foreground-muted">
              {list.total.toLocaleString()}
            </span>
          ) : null}
        </div>

        {list.rows.length === 0 && !list.loading ? (
          <p className="px-5 pt-6 text-[14px] text-foreground-muted">
            {debouncedQuery
              ? `Nothing matched “${debouncedQuery}”.`
              : 'No features in this set yet.'}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-black/[0.08] border-t border-black/[0.06]">
            {list.rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition active:bg-black/[0.04]"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-foreground">
                    <IconMapPin className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-foreground">
                        {atlasFeatureLabel(row)}
                      </span>
                      {row.featured ? (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-lake-blue">
                          Featured
                        </span>
                      ) : null}
                    </span>
                    {row.blurb ? (
                      <span className="mt-0.5 line-clamp-2 text-[13px] text-foreground-muted">
                        {row.blurb}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-[13px] capitalize text-foreground-muted">
                        {row.geomType}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div ref={sentinelRef} className="h-8" />
        {list.loading ? (
          <p className="px-5 py-3 text-center text-[13px] text-foreground-muted">
            Loading…
          </p>
        ) : null}
      </div>
    </PageScroll>
  );
}
