'use client';

import { DiscoverPlacesInterestsSummary } from '@/features/discover/DiscoverPlacesInterestsSummary';
import { useAuthSafe } from '@/features/auth';

/**
 * Same place pills as Discover — tap opens the place record.
 * The Places feed below always shows posts from all of your places.
 */
export function FeedPlacesStories() {
  const { account } = useAuthSafe();
  return (
    <div className="border-b border-black/[0.08] pb-3">
      <DiscoverPlacesInterestsSummary accountId={account?.id ?? null} />
    </div>
  );
}
