import NewPageWrapper from '@/components/layout/NewPageWrapper';
import MemoriesLeftSidebar from '@/components/memories/MemoriesLeftSidebar';
import MemoriesRightSidebar from '@/components/memories/MemoriesRightSidebar';
import MemoriesFeed from '@/components/memories/MemoriesFeed';

/**
 * Memories page - Personal vault for Minnesota memories
 * Photo upload, library management, pin links, timeline views
 */
export default function MemoriesPage() {
  return (
    <NewPageWrapper
      leftSidebar={<MemoriesLeftSidebar />}
      rightSidebar={<MemoriesRightSidebar />}
    >
      <MemoriesFeed />
    </NewPageWrapper>
  );
}
