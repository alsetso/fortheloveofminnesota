import NewPageWrapper from '@/components/layout/NewPageWrapper';
import SavedLeftSidebar from '@/components/saved/SavedLeftSidebar';
import SavedRightSidebar from '@/components/saved/SavedRightSidebar';
import SavedFeed from '@/components/saved/SavedFeed';

/**
 * Saved page - User's saved/bookmarked content from other users
 * Pins, posts, mentions, etc. from Love of Minnesota community
 */
export default function SavedPage() {
  return (
    <NewPageWrapper
      leftSidebar={<SavedLeftSidebar />}
      rightSidebar={<SavedRightSidebar />}
    >
      <SavedFeed />
    </NewPageWrapper>
  );
}
