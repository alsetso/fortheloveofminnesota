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
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <h2 className="text-sm font-semibold text-gray-900">Collections</h2>
      </div>

      {/* Collections List */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <ProfileCollectionsList
          accountId={accountId}
          isOwnProfile={isOwnProfile}
          onCollectionUpdated={onCollectionsUpdate}
        />
      </div>
    </div>
  );
}
