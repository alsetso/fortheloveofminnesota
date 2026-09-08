'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSafe } from '@/features/auth';
import { DiscoverFindBar } from '@/features/discover/DiscoverFindBar';
import { DiscoverRecentSearches } from '@/features/discover/DiscoverRecentSearches';
import { DiscoverSearchResults } from '@/features/discover/DiscoverSearchResults';
import {
  DISCOVER_SEARCH_MIN_QUERY,
  fetchDiscoverSearch,
  type DiscoverSearchHit,
  type DiscoverSearchRecentRow,
  type DiscoverSearchSection,
} from '@/features/discover/discoverSearchApi';
import {
  DockPaneShell,
  DockSkeletonRows,
} from '@/features/map/dockCore/panes/DockPaneShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  setMapSearchQuery,
  useMapSearchQuery,
} from '@/features/map/dockCore/store/mapSearchStore';
import { useCommitMinnesotaMapPoint } from '@/lib/geo/commitMinnesotaMapPoint';

const DEBOUNCE_MS = 280;

/**
 * Full-height Discover catalog search inside the map dock.
 * Pill focus → openSearch() → this pane; query lives in mapSearchStore.
 */
export default function DockSearchPane() {
  const { cancelSearch, openContactsSheet, openSelectedPoint } = useMapDock();
  const searchQuery = useMapSearchQuery();
  const { commit } = useCommitMinnesotaMapPoint();
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;

  const q = searchQuery.trim();
  const [status, setStatus] = useState<'idle' | 'searching' | 'ready' | 'error'>('idle');
  const [sections, setSections] = useState<DiscoverSearchSection[]>([]);
  const [recent, setRecent] = useState<DiscoverSearchRecentRow[]>([]);
  const reqId = useRef(0);

  useEffect(() => {
    const ac = new AbortController();
    const requestId = ++reqId.current;

    if (q.length < DISCOVER_SEARCH_MIN_QUERY) {
      setSections([]);
      setStatus('idle');
      if (!accountId) {
        setRecent([]);
        return () => {
          ac.abort();
        };
      }
      void fetchDiscoverSearch('', ac.signal)
        .then((result) => {
          if (ac.signal.aborted || requestId !== reqId.current) return;
          setRecent(result.recent ?? []);
        })
        .catch(() => {
          if (ac.signal.aborted || requestId !== reqId.current) return;
          setRecent([]);
        });
      return () => {
        ac.abort();
      };
    }

    setStatus('searching');
    const timer = window.setTimeout(() => {
      void fetchDiscoverSearch(q, ac.signal)
        .then((result) => {
          if (ac.signal.aborted || requestId !== reqId.current) return;
          setSections(result.sections);
          setStatus('ready');
        })
        .catch(() => {
          if (ac.signal.aborted || requestId !== reqId.current) return;
          setSections([]);
          setStatus('error');
        });
    }, DEBOUNCE_MS);

    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [accountId, q]);

  const onPlaceSelect = useCallback(
    async (hit: DiscoverSearchHit) => {
      const lat = hit.meta?.lat;
      const lng = hit.meta?.lng;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }
      const result = await commit(
        { lat, lng },
        { source: 'mapSearch', fly: true, label: hit.title },
      );
      if (result.ok) openSelectedPoint();
      cancelSearch();
    },
    [cancelSearch, commit, openSelectedPoint],
  );

  const onHitNavigate = useCallback(() => {
    cancelSearch();
  }, [cancelSearch]);

  const typedEnough = q.length >= DISCOVER_SEARCH_MIN_QUERY;
  const searching = status === 'searching';
  const noResults =
    typedEnough && !searching && status === 'ready' && sections.length === 0;

  return (
    <DockPaneShell>
      <div className="pb-6">
        {!typedEnough ? (
          <>
            <div className="pt-1 pb-3">
              <DiscoverFindBar
                compact
                onPeople={() => {
                  openContactsSheet({ kind: 'people' });
                }}
                onAddress={() => {
                  openContactsSheet({ kind: 'addresses' });
                }}
                onBusiness={() => {
                  cancelSearch();
                }}
              />
            </div>

            {accountId ? (
              <DiscoverRecentSearches
                rows={recent}
                onSelect={setMapSearchQuery}
                compact
              />
            ) : null}
          </>
        ) : searching ? (
          <DockSkeletonRows count={4} />
        ) : status === 'error' ? (
          <p className="px-0.5 py-6 text-center text-[14px] text-foreground-muted">
            Couldn&apos;t search right now. Try again.
          </p>
        ) : noResults ? (
          <p className="px-0.5 py-6 text-center text-[14px] text-foreground-muted">
            Nothing matched “{q}”.
          </p>
        ) : (
          <DiscoverSearchResults
            query={q}
            sections={sections}
            onPlaceSelect={(hit) => {
              void onPlaceSelect(hit);
            }}
            onNavigate={onHitNavigate}
            compact
          />
        )}
      </div>
    </DockPaneShell>
  );
}
