import NewPageWrapper from '@/components/layout/NewPageWrapper';
import ExploreLeftSidebar from '@/components/explore/ExploreLeftSidebar';
import ExploreRightSidebar from '@/components/explore/ExploreRightSidebar';
import ExploreContent from '@/components/explore/ExploreContent';
import PageViewTracker from '@/components/analytics/PageViewTracker';

/**
 * Explore page - Discover all of Minnesota on Love of Minnesota
 * Browse cities, counties, maps, posts, and locations
 */
export default function ExplorePage() {
  return (
    <>
      <PageViewTracker />
      <NewPageWrapper
        leftSidebar={<ExploreLeftSidebar />}
        rightSidebar={<ExploreRightSidebar />}
      >
        <ExploreContent />
      </NewPageWrapper>
    </>
  );
}
