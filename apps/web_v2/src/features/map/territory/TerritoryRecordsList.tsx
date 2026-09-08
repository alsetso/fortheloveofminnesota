'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  DockActionRow,
  DockPaneShell,
  DockSection,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  getTerritoryLayer,
  rowLabel,
  rowSubtitle,
  rowKindLabel,
  type TerritorySlug,
} from '@/features/map/territory/territoryLayers';
import { showTerritorySelection } from '@/features/map/territory/territorySelection';
import type { SelectionKind } from '@/features/map/territory/territorySelection';

const PAGE_SIZE = 25;

type RecordsResponse = {
  rows: Record<string, unknown>[];
  total: number;
  offset: number;
  limit: number;
};

/** Alphabetical territory records with infinite scroll (25 / page). */
export function TerritoryRecordsList({ slug }: { slug: TerritorySlug }) {
  const config = getTerritoryLayer(slug);
  const { openDetails } = useMapDock();

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(async () => {
    if (!config || loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const offset = offsetRef.current;
      const res = await fetch(
        `/api/territory/layers/${slug}/records?offset=${offset}&limit=${PAGE_SIZE}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Failed to load records');
      }
      const body = (await res.json()) as RecordsResponse;
      setRows((prev) => (offset === 0 ? body.rows : [...prev, ...body.rows]));
      setTotal(body.total);
      offsetRef.current = offset + body.rows.length;
      const more = offset + body.rows.length < body.total;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [config, slug]);

  useEffect(() => {
    offsetRef.current = 0;
    hasMoreRef.current = true;
    loadingRef.current = false;
    setRows([]);
    setTotal(0);
    setHasMore(true);
    setError(null);
    void loadPage();
  }, [slug, loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadPage();
        }
      },
      { rootMargin: '160px', threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadPage]);

  if (!config) {
    return (
      <DockPaneShell>
        <p className="px-0.5 text-sm text-foreground-muted">Unknown layer.</p>
      </DockPaneShell>
    );
  }

  const onRow = async (row: Record<string, unknown>) => {
    const id = String(row.id ?? '');
    if (!id) return;
    const title = rowLabel(config, row);
    const subtitle = rowSubtitle(config, row);

    // Selection highlight is independent of Controls — do not ensureActive.
    void showTerritorySelection(config.entityKind as SelectionKind, id);

    openDetails({
      id,
      kind: config.entityKind,
      title,
      subtitle,
      kindLabel: rowKindLabel(config, row),
    });
  };

  return (
    <DockPaneShell>
      <div className="space-y-3 pb-8">
        <DockSection
          title={config.label}
          subtitle={total > 0 ? `${total.toLocaleString()} · A–Z` : config.subtitle}
        >
          {error ? <p className="px-0.5 text-sm text-red-700">{error}</p> : null}
          {rows.map((row) => {
            const id = String(row.id ?? '');
            return (
              <DockActionRow
                key={id}
                title={rowLabel(config, row)}
                subtitle={rowSubtitle(config, row)}
                onClick={() => void onRow(row)}
              />
            );
          })}
          <div ref={sentinelRef} className="h-8" aria-hidden />
          {loading ? (
            <p className="px-0.5 text-center text-xs text-foreground-muted">Loading…</p>
          ) : null}
          {!loading && !hasMore && rows.length > 0 ? (
            <p className="px-0.5 text-center text-xs text-foreground-muted">End of list</p>
          ) : null}
        </DockSection>
      </div>
    </DockPaneShell>
  );
}
