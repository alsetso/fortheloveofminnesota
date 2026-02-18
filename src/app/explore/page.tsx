import { Suspense } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import ExploreLeftSidebar from '@/components/explore/ExploreLeftSidebar';
import ExploreRightSidebar from '@/components/explore/ExploreRightSidebar';
import ExploreContent from '@/components/explore/ExploreContent';
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
        <NewPageWrapper
          leftSidebar={<ExploreLeftSidebar />}
          rightSidebar={<ExploreRightSidebar />}
        >
          <ExploreContent />
        </NewPageWrapper>
      </Suspense>
    </>
  );
}
