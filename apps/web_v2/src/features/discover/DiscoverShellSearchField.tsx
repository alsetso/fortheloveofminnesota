'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { FeedSearchField } from '@/features/feed/FeedSearchField';
import {
  clearDiscoverSearchQuery,
  getDiscoverSearchQuery,
  setDiscoverSearchQuery,
  subscribeDiscoverSearchQuery,
} from '@/features/discover/discoverSearchQueryStore';
import { persistDiscoverSearchCompletion } from '@/features/discover/discoverSearchApi';
import { DISCOVER_SEARCH_MIN_QUERY } from '@/lib/discover/search/types';

/**
 * Shell TopBar search field while Discover lightbox is open on home.
 */
export function DiscoverShellSearchField() {
  const query = useSyncExternalStore(
    subscribeDiscoverSearchQuery,
    getDiscoverSearchQuery,
    getDiscoverSearchQuery,
  );

  const onCancel = useCallback(() => {
    clearDiscoverSearchQuery();
  }, []);

  const onSubmit = useCallback(() => {
    const trimmed = getDiscoverSearchQuery().trim();
    if (trimmed.length < DISCOVER_SEARCH_MIN_QUERY) return;
    void persistDiscoverSearchCompletion({
      query: trimmed,
      completedVia: 'submit',
    });
  }, []);

  return (
    <div className="pb-2.5 pt-1">
      <div className="px-4">
        <FeedSearchField
          value={query}
          onChange={setDiscoverSearchQuery}
          onCancel={onCancel}
          onSubmit={onSubmit}
          placeholder="Search people, territories, atlas…"
          autoFocus
        />
      </div>
    </div>
  );
}
