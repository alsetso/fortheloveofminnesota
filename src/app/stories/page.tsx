import NewPageWrapper from '@/components/layout/NewPageWrapper';
import StoriesLeftSidebar from '@/components/stories/StoriesLeftSidebar';
import StoriesList from '@/components/stories/StoriesList';

/**
 * Stories list page - Browse all stories
 * Route: /stories
 */
export default function StoriesPage() {
  return (
    <NewPageWrapper
      leftSidebar={<StoriesLeftSidebar />}
    >
      <StoriesList />
    </NewPageWrapper>
  );
}
