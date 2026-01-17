'use client';

import ProfileCollectionsList from './ProfileCollectionsList';

interface ProfileCollectionsContainerProps {
  accountId: string;
  isOwnProfile: boolean;
  onCollectionsUpdate?: () => void;
}

export default function ProfileCollectionsContainer({
  accountId,
  isOwnProfile,
  onCollectionsUpdate,
}: ProfileCollectionsContainerProps) {
  return (
    <div>
      {/* Collections List */}
      <div className="p-[10px]">
        <ProfileCollectionsList
          accountId={accountId}
          isOwnProfile={isOwnProfile}
          onCollectionUpdated={onCollectionsUpdate}
        />
      </div>
    </div>
  );
}
