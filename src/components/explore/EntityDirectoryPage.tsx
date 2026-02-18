'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronUpDownIcon,
  MapIcon,
  ListBulletIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  getEntityConfig,
  entityUrl,
} from '@/features/explore/config/entityRegistry';
import ExploreBreadcrumb from '@/components/explore/ExploreBreadcrumb';
import { LAYER_SLUGS } from '@/features/map/config/layersConfig';
import dynamic from 'next/dynamic';

const DirectoryMapView = dynamic(() => import('@/components/explore/DirectoryMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-md border border-border bg-surface-accent flex items-center justify-center" style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>
      <span className="text-xs text-foreground-muted">Loading map…</span>
    </div>
  ),
});

/* ─── props ─── */

interface EntityDirectoryPageProps {
  /** Entity type slug (e.g. "counties") */
  entitySlug: string;
}

/* ─── component ─── */

export default function EntityDirectoryPage({ entitySlug }: EntityDirectoryPageProps) {
  const config = getEntityConfig(entitySlug);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortKey, setSortKey] = useState(config?.defaultSort ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(config?.defaultSortDir ?? 'asc');
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const pageSize = config?.pageSize ?? 100;
  const isPaginated = Boolean(config?.supportsPagination);

  /** Can this entity render an inline map? Layers use ExploreTableLayout, atlas uses DirectoryMapView */
  const canShowInlineMap = Boolean(config?.hasCoordinates && !LAYER_SLUGS.includes(entitySlug));
  /** Can this entity link to the full ExploreTableLayout map? */
  const canShowLayerMap = Boolean(config?.hasGeometry && LAYER_SLUGS.includes(entitySlug));

  /** All records for map view — fetched once on first map toggle */
  const [mapRecords, setMapRecords] = useState<Record<string, unknown>[] | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  useEffect(() => {
    if (viewMode !== 'map' || !canShowInlineMap || !config || mapRecords != null) return;
    setMapLoading(true);
    const params = new URLSearchParams({ limit: '1200', offset: '0', ...config.apiParams });
    fetch(`${config.apiEndpoint}?${params}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        setMapRecords(data);
      })
      .catch(() => setMapRecords([]))
      .finally(() => setMapLoading(false));
  }, [viewMode, canShowInlineMap, config, mapRecords]);

  /* ── fetch records (initial: all or first page) ── */
  useEffect(() => {
    if (!config) return;
    setLoading(true);
    setTotalCount(null);

    if (isPaginated) {
      const params = new URLSearchParams({ limit: String(pageSize), offset: '0', ...config.apiParams });
      fetch(`${config.apiEndpoint}?${params}`)
        .then((r) => (r.ok ? r.json() : { data: [], total: 0 }))
        .then((json: { data?: unknown[]; total?: number }) => {
          const data = Array.isArray(json?.data) ? json.data : [];
          setRecords(data);
          setTotalCount(typeof json?.total === 'number' ? json.total : data.length);
        })
        .catch(() => {
          setRecords([]);
          setTotalCount(0);
        })
        .finally(() => setLoading(false));
      return;
    }

    const params = new URLSearchParams({ limit: '3000', ...config.apiParams });
    const url =
      config.id === 'news'
        ? `${config.apiEndpoint}?limit=50`
        : `${config.apiEndpoint}?${params}`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.articles)
            ? data.articles
            : [];
        setRecords(arr);
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [config, isPaginated, pageSize]);

  /* ── sort & filter ── */
  const processed = useMemo(() => {
    let arr = [...records];

    if (filter && config) {
      const q = filter.toLowerCase();
      arr = arr.filter((r) => {
        const name = r[config.nameField];
        return name != null && String(name).toLowerCase().includes(q);
      });
    }

    if (sortKey) {
      arr.sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        const sa = String(va).toLowerCase();
        const sb = String(vb).toLowerCase();
        return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }

    return arr;
  }, [records, filter, sortKey, sortDir, config]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  async function loadMore() {
    if (!config || !isPaginated || loadingMore || totalCount == null || records.length >= totalCount) return;
    setLoadingMore(true);
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(records.length), ...config.apiParams });
    try {
      const r = await fetch(`${config.apiEndpoint}?${params}`);
      const json = r.ok ? (await r.json()) : { data: [], total: totalCount };
      const data = Array.isArray(json?.data) ? json.data : [];
      setRecords((prev) => [...prev, ...data]);
    } finally {
      setLoadingMore(false);
    }
  }

  const baseUrl = config ? entityUrl(config) : `/explore/${entitySlug}`;
  const detailBaseUrl = config?.detailSlug ? `/explore/${config.detailSlug}` : baseUrl;

  function switchToMap() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'map');
    router.push(`${baseUrl}?${params}`, { scroll: false });
  }

  if (!config) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-6">
        <p className="text-sm text-foreground-muted">Entity type not found.</p>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="max-w-[960px] mx-auto w-full px-4 py-4 space-y-4">
      {/* ── breadcrumb ── */}
      <ExploreBreadcrumb entitySlug={entitySlug} />

      {/* ── header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Icon className="w-5 h-5 text-foreground-muted" />
            {config.label}
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">{config.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canShowLayerMap && (
            <button
              onClick={switchToMap}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
            >
              <MapIcon className="w-3.5 h-3.5" />
              Map View
            </button>
          )}
          {canShowInlineMap && (
            <button
              onClick={() => setViewMode((v) => (v === 'list' ? 'map' : 'list'))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
            >
              {viewMode === 'list' ? (
                <>
                  <MapIcon className="w-3.5 h-3.5" />
                  Map
                </>
              ) : (
                <>
                  <ListBulletIcon className="w-3.5 h-3.5" />
                  List
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── filter ── */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={`Filter ${config.label.toLowerCase()}…`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 h-8 px-2.5 bg-surface-accent rounded text-xs text-foreground placeholder:text-foreground-muted border-none focus:outline-none focus:ring-1 focus:ring-lake-blue"
        />
        <div className="text-[10px] text-foreground-subtle flex-shrink-0">
          {loading ? '…' : totalCount != null ? `${processed.length} of ${totalCount.toLocaleString()}` : `${processed.length} records`}
        </div>
      </div>

      {/* ── map view (inline for hasCoordinates entities) ── */}
      {viewMode === 'map' && canShowInlineMap && config && (
        mapLoading || mapRecords == null ? (
          <div className="w-full rounded-md border border-border bg-surface-accent flex items-center justify-center" style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>
            <span className="text-xs text-foreground-muted">Loading all records…</span>
          </div>
        ) : (
          <DirectoryMapView
            config={config}
            records={mapRecords
              .filter((r) => r.lat != null && r.lng != null)
              .map((r) => ({
                id: String(r.id ?? ''),
                slug: r.slug as string | undefined,
                name: String(r[config.nameField] ?? ''),
                lat: Number(r.lat),
                lng: Number(r.lng),
              }))}
          />
        )
      )}

      {/* ── table ── */}
      {viewMode === 'list' && loading ? (
        <TableSkeleton cols={config.directoryColumns.length} />
      ) : viewMode === 'list' && processed.length === 0 ? (
        <div className="text-xs text-foreground-muted py-8 text-center border border-border rounded-md">
          {filter ? 'No matching records' : `No ${config.label.toLowerCase()} found`}
        </div>
      ) : viewMode === 'list' ? (
        <div className="border border-border rounded-md overflow-hidden">
          {/* header row */}
          <div className="flex items-center bg-surface-accent border-b border-border">
            <div className="w-10 flex-shrink-0" />
            {config.directoryColumns.map((col) => (
              <button
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className="flex-1 flex items-center gap-1 px-2 py-2 text-[10px] text-foreground-muted uppercase tracking-wider hover:text-foreground transition-colors text-left"
              >
                {col.label}
                <ChevronUpDownIcon
                  className={`w-3 h-3 ${sortKey === col.key ? 'text-foreground' : 'text-foreground-subtle'}`}
                />
              </button>
            ))}
            <div className="w-7 flex-shrink-0" />
          </div>

          {/* rows */}
          <div className="divide-y divide-border max-h-[calc(100vh-320px)] overflow-y-auto">
            {processed.map((rec, i) => {
              const rSlug = rec.slug as string | undefined;
              const rId = rec.id as string | undefined;
              const recordKey = (config.schema === 'atlas' && rSlug) ? rSlug : rId;
              const recordHref = recordKey ? `${detailBaseUrl}/${recordKey}` : '#';
              return (
                <Link
                  key={rId ?? i}
                  href={recordHref}
                  className="flex items-center hover:bg-surface-accent transition-colors group"
                >
                  <div className="w-10 flex-shrink-0 text-center text-[10px] text-foreground-subtle tabular-nums py-2">
                    {i + 1}
                  </div>
                  {config.directoryColumns.map((col) => {
                    const val = rec[col.key];
                    return (
                      <div
                        key={col.key}
                        className="flex-1 px-2 py-2 text-xs text-foreground truncate group-hover:text-lake-blue transition-colors"
                      >
                        {val != null
                          ? col.format === 'number'
                            ? Number(val).toLocaleString()
                            : String(val)
                          : '—'}
                      </div>
                    );
                  })}
                  <div className="w-7 flex-shrink-0 flex items-center justify-center">
                    <ChevronRightIcon className="w-3 h-3 text-foreground-subtle" />
                  </div>
                </Link>
              );
            })}
          </div>
          {isPaginated && totalCount != null && records.length < totalCount && !loading && (
            <div className="border-t border-border p-2 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-3 py-1.5 rounded-md border border-border text-xs text-foreground-muted hover:bg-surface-accent hover:text-foreground disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Loading…' : `Load more (${records.length.toLocaleString()} of ${totalCount.toLocaleString()})`}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ─── sub-components ─── */

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="border border-border rounded-md">
      <div className="flex items-center bg-surface-accent border-b border-border h-8" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center border-b border-border last:border-b-0 h-10 px-2.5">
          <div className="h-3 rounded bg-surface-accent animate-pulse" style={{ width: `${40 + (i % 3) * 15}%` }} />
        </div>
      ))}
    </div>
  );
}
