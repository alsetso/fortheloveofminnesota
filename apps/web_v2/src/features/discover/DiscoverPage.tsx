'use client';

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { PageScroll } from '@/features/appShell/PageScroll';
import { useAuthSafe } from '@/features/auth';
import { DiscoverAtlasSection } from '@/features/discover/DiscoverAtlasSection';
import { DiscoverPlacesInterestsSummary } from '@/features/discover/DiscoverPlacesInterestsSummary';
import { DiscoverRecentSearches } from '@/features/discover/DiscoverRecentSearches';
import { DiscoverSearchResults } from '@/features/discover/DiscoverSearchResults';
import { DiscoverFindBar } from '@/features/discover/DiscoverFindBar';
import { useDiscoverLightbox } from '@/features/discover/discoverLightboxContext';
import {
  DISCOVER_SEARCH_MIN_QUERY,
  fetchDiscoverSearch,
  persistDiscoverSearchCompletion,
  type DiscoverSearchRecentRow,
  type DiscoverSearchSection,
} from '@/features/discover/discoverSearchApi';
import {
  clearDiscoverSearchQuery,
  getDiscoverSearchQuery,
  setDiscoverSearchQuery,
  subscribeDiscoverSearchQuery,
} from '@/features/discover/discoverSearchQueryStore';
import { FeedSearchField } from '@/features/feed/FeedSearchField';
import { TopBar } from '@/features/appShell/TopBar';
import { PAGES_NEW_PATH } from '@/lib/routes/routePolicy';
import { IconPlus } from '@/features/map/dockCore/core/icons';

const SEARCH_DEBOUNCE_MS = 280;

/**
 * /discover — idle browse + recent; typed query → unified catalog search.
 * On the map lightbox, shell TopBar owns title / search chrome.
 */
export default function DiscoverPage() {
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const inLightbox = useDiscoverLightbox();
  const storeQuery = useSyncExternalStore(
    subscribeDiscoverSearchQuery,
    getDiscoverSearchQuery,
    getDiscoverSearchQuery,
  );
  const [localQuery, setLocalQuery] = useState('');
  const query = inLightbox ? storeQuery : localQuery;
  const setQuery = inLightbox ? setDiscoverSearchQuery : setLocalQuery;
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sections, setSections] = useState<DiscoverSearchSection[]>([]);
  const [recent, setRecent] = useState<DiscoverSearchRecentRow[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'ready' | 'error'>(
    'idle',
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Idle: load recent completed searches for the signed-in account.
  useEffect(() => {
    if (debouncedQuery.length >= DISCOVER_SEARCH_MIN_QUERY) return;
    if (!accountId) {
      setRecent([]);
      return;
    }

    const ac = new AbortController();
    void fetchDiscoverSearch('', ac.signal)
      .then((result) => {
        if (ac.signal.aborted) return;
        setRecent(result.recent ?? []);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setRecent([]);
      });

    return () => ac.abort();
  }, [accountId, debouncedQuery]);

  useEffect(() => {
    const q = debouncedQuery;
    if (q.length < DISCOVER_SEARCH_MIN_QUERY) {
      setSections([]);
      setSearchStatus('idle');
      return;
    }

    setSearchStatus('searching');
    const ac = new AbortController();
    void fetchDiscoverSearch(q, ac.signal)
      .then((result) => {
        if (ac.signal.aborted) return;
        setSections(result.sections);
        setSearchStatus('ready');
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setSections([]);
        setSearchStatus('error');
      });

    return () => ac.abort();
  }, [debouncedQuery]);

  const typedEnough = debouncedQuery.length >= DISCOVER_SEARCH_MIN_QUERY;
  const searching = searchStatus === 'searching';
  const noResults =
    typedEnough && !searching && searchStatus === 'ready' && sections.length === 0;

  const onCancelSearch = useCallback(() => {
    if (inLightbox) clearDiscoverSearchQuery();
    else {
      setLocalQuery('');
      setDebouncedQuery('');
    }
    setSections([]);
    setSearchStatus('idle');
  }, [inLightbox]);

  const onSelectRecent = useCallback(
    (next: string) => {
      setQuery(next);
    },
    [setQuery],
  );

  const onSubmitSearch = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < DISCOVER_SEARCH_MIN_QUERY) return;
    setDebouncedQuery(trimmed);
    void persistDiscoverSearchCompletion({
      query: trimmed,
      completedVia: 'submit',
    });
  }, [query]);

  return (
    <PageScroll>
      {!inLightbox ? (
        <TopBar
          title="Discover"
          trailing={
            <Link
              href={PAGES_NEW_PATH}
              aria-label="Create a page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lake-blue transition active:bg-black/[0.05]"
            >
              <IconPlus className="h-5 w-5" />
            </Link>
          }
          below={
            <div className="pb-2.5 pt-1">
              <div className="px-4">
                <FeedSearchField
                  value={query}
                  onChange={setQuery}
                  onCancel={onCancelSearch}
                  onSubmit={onSubmitSearch}
                  placeholder="Search people, territories, atlas…"
                />
              </div>
            </div>
          }
        />
      ) : null}

      <div className="pb-10">
        {!typedEnough ? (
          <>
            <div className="pt-1 pb-3">
              <DiscoverFindBar />
            </div>

            {accountId ? (
              <DiscoverRecentSearches rows={recent} onSelect={onSelectRecent} />
            ) : null}

            <DiscoverAtlasSection />

            <DiscoverPlacesInterestsSummary accountId={accountId} />
          </>
        ) : searching ? (
          <p className="px-5 py-10 text-center text-[14px] text-foreground-muted">
            Searching…
          </p>
        ) : searchStatus === 'error' ? (
          <p className="px-5 py-10 text-center text-[14px] text-foreground-muted">
            Couldn&apos;t search right now. Try again.
          </p>
        ) : noResults ? (
          <p className="px-5 py-10 text-center text-[14px] text-foreground-muted">
            Nothing matched “{debouncedQuery}”.
          </p>
        ) : (
          <DiscoverSearchResults query={debouncedQuery} sections={sections} />
        )}
      </div>
    </PageScroll>
  );
}
