import { Suspense } from 'react';
import ExplorePageClient from '@/components/explore/ExplorePageClient';
import PageViewTracker from '@/components/analytics/PageViewTracker';

/**
 * /explore — Minnesota, made legible.
 * Civic dashboard: stats, news, city rankings, boundary navigation.
 * County scoping via ?county= URL param driven by left sidebar.
 */
export default function ExplorePage() {
  return (
    <>
      <PageViewTracker />
      <Suspense>
        <ExplorePageClient />
      </Suspense>
    </>
  );
}
