'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { passportKindBySlug, territoryPresenceUiEnabledBySlug } from '@/features/accountTerritories/store/passportKinds';
import { PageScroll } from '@/features/appShell/PageScroll';
import { useAuthSafe } from '@/features/auth';
import { DiscoverTerritoryLayerMap } from '@/features/discover/DiscoverTerritoryLayerMap';
import { DiscoverVisitedMap } from '@/features/discover/DiscoverVisitedMap';
import { FeedSearchField } from '@/features/feed/FeedSearchField';
import { IconArrowLeft, IconPlus } from '@/features/map/dockCore/core/icons';
import { getTerritoryLayer } from '@/features/map/territory/territoryLayers';
import { followCity } from '@/lib/accountPlaces/api';
import { useAccountPlaceRows } from '@/lib/accountPlaces/store';
import {
  directoryTerritoryPath,
  DISCOVER_PATH,
} from '@/lib/routes/routePolicy';
import { safePadTop } from '@/lib/despia/safeArea';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 280;

type ListTab = 'yours' | 'browse';

type DiscoverKindRow = {
  id: string;
  name: string;
  subtitle: string | null;
  kindLabel: string;
  visited: boolean;
  firstSeenAt: string | null;
};

type BucketResponse = {
  kind: string;
  unitKind: string;
  label: string;
  bucket: 'visited' | 'remaining' | 'all';
  rows: DiscoverKindRow[];
  total: number;
  visitedTotal: number;
  remainingTotal: number;
  offset: number;
  limit: number;
};

type BucketState = {
  rows: DiscoverKindRow[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

const EMPTY_BUCKET: BucketState = {
  rows: [],
  total: 0,
  hasMore: true,
  loading: false,
  error: null,
};

function useBucketList(
  slug: string,
  bucket: 'visited' | 'remaining' | 'all',
  query: string,
  enabled = true,
) {
  const [state, setState] = useState<BucketState>(EMPTY_BUCKET);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const queryRef = useRef(query);
  queryRef.current = query;

  const loadMore = useCallback(
    async (reset: boolean) => {
      if (!enabled || loadingRef.current) return;
      if (!reset && !hasMoreRef.current) return;
      loadingRef.current = true;
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        ...(reset ? { rows: [], total: 0, hasMore: true } : null),
      }));
      if (reset) {
        offsetRef.current = 0;
        hasMoreRef.current = true;
      }
      try {
        const offset = reset ? 0 : offsetRef.current;
        const params = new URLSearchParams({
          bucket,
          offset: String(offset),
          limit: String(PAGE_SIZE),
        });
        const q = queryRef.current.trim();
        if (q) params.set('q', q);
        const res = await fetch(`/api/discover/${encodeURIComponent(slug)}?${params}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? 'Failed to load');
        }
        const body = (await res.json()) as BucketResponse;
        const nextRows = body.rows ?? [];
        const nextOffset = offset + nextRows.length;
        const more = nextOffset < (body.total ?? 0);
        offsetRef.current = nextOffset;
        hasMoreRef.current = more;
        setState((prev) => ({
          rows: reset ? nextRows : [...prev.rows, ...nextRows],
          total: body.total ?? nextRows.length,
          hasMore: more,
          loading: false,
          error: null,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load',
        }));
      } finally {
        loadingRef.current = false;
      }
    },
    [bucket, enabled, slug],
  );

  useEffect(() => {
    if (!enabled) return;
    void loadMore(true);
  }, [enabled, loadMore, query]);

  return { ...state, loadMore: () => void loadMore(false) };
}

function ListTabs({
  active,
  yoursTotal,
  allTotal,
  onChange,
}: {
  active: ListTab;
  yoursTotal: number;
  allTotal: number;
  onChange: (tab: ListTab) => void;
}) {
  const tabs: { id: ListTab; label: string; count: number }[] = [
    { id: 'yours', label: 'Yours', count: yoursTotal },
    { id: 'browse', label: 'All', count: allTotal },
  ];

  return (
    <div
      role="tablist"
      aria-label="Territory lists"
      className="relative flex border-b border-black/[0.08] px-5"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative mr-5 inline-flex shrink-0 items-center gap-1.5 pb-2.5 pt-3 transition-colors active:opacity-70 ${
              isActive
                ? 'font-bold text-foreground'
                : 'font-medium text-foreground-muted'
            }`}
          >
            <span className="text-[15px]">{tab.label}</span>
            <span className="text-[13px] tabular-nums text-foreground-muted">
              {tab.count.toLocaleString()}
            </span>
            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-foreground"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function TerritoryList({
  state,
  onLoadMore,
  onOpen,
  emptyLabel,
  showAdd,
  addedUnitIds,
  onAdd,
  addBusyId,
  showPresenceDots,
}: {
  state: BucketState;
  onLoadMore: () => void;
  onOpen: (row: DiscoverKindRow) => void;
  emptyLabel: string;
  showAdd: boolean;
  addedUnitIds: Set<string>;
  onAdd: (row: DiscoverKindRow) => void;
  addBusyId: string | null;
  showPresenceDots: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && state.hasMore && !state.loading) {
          onLoadMore();
        }
      },
      { rootMargin: '200px', threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onLoadMore, state.hasMore, state.loading]);

  if (state.error) {
    return <p className="px-5 pt-3 text-[14px] text-red-700">{state.error}</p>;
  }

  if (state.rows.length === 0 && !state.loading) {
    return <p className="px-5 pt-4 text-[14px] text-foreground-muted">{emptyLabel}</p>;
  }

  return (
    <>
      <div className="divide-y divide-black/[0.08] border-y border-black/[0.06] bg-white/60">
        {state.rows.map((row) => {
          const added = addedUnitIds.has(row.id);
          const adding = addBusyId === row.id;
          return (
            <div
              key={row.id}
              className="flex items-center gap-3 px-5 py-3 transition active:bg-black/[0.03]"
            >
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                {showPresenceDots ? (
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      row.visited ? 'bg-lake-blue' : 'bg-black/15'
                    }`}
                    aria-hidden
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-foreground">
                    {row.name}
                  </span>
                  {row.subtitle ? (
                    <span className="mt-0.5 block truncate text-[13px] text-foreground-muted">
                      {row.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
              {showAdd ? (
                added ? (
                  <span className="shrink-0 px-2 text-[13px] font-semibold text-foreground-muted">
                    Added
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={adding}
                    onClick={() => onAdd(row)}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-lake-blue transition active:opacity-60 disabled:opacity-50"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                    Add
                  </button>
                )
              ) : null}
            </div>
          );
        })}
      </div>
      <div ref={sentinelRef} className="h-6" aria-hidden />
      {state.loading ? (
        <p className="px-5 pb-2 text-center text-[12px] text-foreground-muted">Loading…</p>
      ) : null}
      {!state.loading && !state.hasMore && state.rows.length > 0 ? (
        <p className="px-5 pb-2 text-center text-[12px] text-foreground-muted">End of list</p>
      ) : null}
    </>
  );
}

/**
 * `/discover/:kind` — CTU: Yours + All with presence. Other kinds: browse-only catalog.
 */
export default function DiscoverKindPage({ kindSlug }: { kindSlug: string }) {
  const router = useRouter();
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const accountPlaces = useAccountPlaceRows();
  const def = passportKindBySlug(kindSlug);
  const config = def ? getTerritoryLayer(def.slug) : undefined;
  const isCtu = kindSlug === 'cities-and-towns';
  const presenceUi = territoryPresenceUiEnabledBySlug(kindSlug);

  const addedUnitIds = useMemo(
    () =>
      new Set(
        accountPlaces
          .map((place) => place.territory_unit_id)
          .filter((id): id is string => Boolean(id)),
      ),
    [accountPlaces],
  );

  const [activeTab, setActiveTab] = useState<ListTab>(presenceUi ? 'yours' : 'browse');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [addBusyId, setAddBusyId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const yours = useBucketList(kindSlug, 'visited', debouncedQuery, presenceUi);
  const remaining = useBucketList(kindSlug, 'remaining', debouncedQuery, presenceUi);
  const catalog = useBucketList(kindSlug, 'all', debouncedQuery, !presenceUi);

  const activeState = presenceUi
    ? activeTab === 'yours'
      ? yours
      : remaining
    : catalog;

  const onOpen = useCallback(
    (row: DiscoverKindRow) => {
      router.push(directoryTerritoryPath(row.id));
    },
    [router],
  );

  const onMapSelect = useCallback(
    (sel: { id: string; name: string }) => {
      router.push(directoryTerritoryPath(sel.id));
    },
    [router],
  );

  const onAdd = useCallback(
    async (row: DiscoverKindRow) => {
      if (!accountId || addBusyId) return;
      setAddBusyId(row.id);
      setAddError(null);
      try {
        await followCity(accountId, row.id, row.name);
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Could not add city.');
      } finally {
        setAddBusyId(null);
      }
    },
    [accountId, addBusyId],
  );

  if (!def || !config) {
    return (
      <PageScroll>
        <div className="px-5 py-10 text-center">
          <p className="text-[16px] font-semibold text-foreground">Unknown territory type</p>
          <Link
            href={DISCOVER_PATH}
            className="mt-3 inline-block text-[15px] font-semibold text-lake-blue"
          >
            Back to Discover
          </Link>
        </div>
      </PageScroll>
    );
  }

  const emptyLabel = presenceUi
    ? activeTab === 'yours'
      ? debouncedQuery
        ? 'Nothing matched that search.'
        : 'Nothing here yet — turn on Find Me and roam.'
      : debouncedQuery
        ? 'Nothing matched that search.'
        : 'You’ve stamped every place in this list.'
    : debouncedQuery
      ? 'Nothing matched that search.'
      : 'No records in this list yet.';

  return (
    <PageScroll>
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
        style={{ paddingTop: safePadTop('0.2rem') }}
      >
        <div className="relative flex h-11 items-center px-3">
          <button
            type="button"
            onClick={() => router.push(DISCOVER_PATH)}
            aria-label="Back to Discover"
            className="relative z-[1] inline-flex h-9 items-center gap-0.5 rounded-full px-1.5 text-lake-blue transition active:opacity-70"
          >
            <IconArrowLeft className="h-5 w-5" />
            <span className="text-[16px] font-semibold">Discover</span>
          </button>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-bold tracking-tight text-foreground">
            {def.label}
          </h1>
          <div className="ml-auto w-[88px]" aria-hidden />
        </div>
        <div className="px-4 pb-2.5 pt-1">
          <FeedSearchField
            value={query}
            onChange={setQuery}
            onCancel={() => setQuery('')}
            placeholder={`Search ${def.label.toLowerCase()}`}
          />
        </div>
        {presenceUi ? (
          <ListTabs
            active={activeTab}
            yoursTotal={yours.total}
            allTotal={remaining.total}
            onChange={setActiveTab}
          />
        ) : null}
      </header>

      {presenceUi ? (
        <DiscoverVisitedMap
          kindSlug={kindSlug}
          label={def.label}
          onSelect={onMapSelect}
        />
      ) : (
        <DiscoverTerritoryLayerMap
          kindSlug={kindSlug}
          label={def.label}
          onSelect={onMapSelect}
        />
      )}

      <div className="pb-12 pt-2">
        {addError ? (
          <p className="px-5 pb-2 text-[13px] text-red-700">{addError}</p>
        ) : null}
        <TerritoryList
          state={activeState}
          onLoadMore={activeState.loadMore}
          onOpen={onOpen}
          emptyLabel={emptyLabel}
          showAdd={isCtu && Boolean(accountId)}
          addedUnitIds={addedUnitIds}
          onAdd={(row) => void onAdd(row)}
          addBusyId={addBusyId}
          showPresenceDots={presenceUi}
        />
      </div>
    </PageScroll>
  );
}
