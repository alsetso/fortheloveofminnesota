import NewPageWrapper from '@/components/layout/NewPageWrapper';
import FriendsLeftSidebar from '@/components/friends/FriendsLeftSidebar';
import FriendsRightSidebar from '@/components/friends/FriendsRightSidebar';
import FriendsFeed from '@/components/friends/FriendsFeed';

/**
 * Friends page - Manage followers, following, and friends
 * Friends = mutual follows (both users follow each other)
 */
export default function FriendsPage() {
  return (
    <NewPageWrapper
      leftSidebar={<FriendsLeftSidebar />}
      rightSidebar={<FriendsRightSidebar />}
    >
      <FriendsFeed />
    </NewPageWrapper>
  );
}
