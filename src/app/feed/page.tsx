import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import NewFeed from '@/components/feed/NewFeed';

/**
 * Feed page with new three-column layout
 * Uses NewPageWrapper with sticky sidebars
 */
export default function FeedPage() {
  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <NewFeed />
    </NewPageWrapper>
  );
}
