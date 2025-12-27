'use client';

import { useMemo, useState } from 'react';
import ProfileCard from './ProfileCard';
import ProfileMentionsSection from './ProfileMentionsSection';
import ProfileCollectionsList from './ProfileCollectionsList';
import ProfileMap from './ProfileMap';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';

interface ProfilePageClientProps {
  account: ProfileAccount;
  pins: ProfilePin[];
  collections: Collection[];
  isOwnProfile: boolean;
}

export default function ProfilePageClient({
  account,
  pins,
  collections,
  isOwnProfile,
}: ProfilePageClientProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const handleCollectionClick = (collectionId: string | null) => {
    setSelectedCollectionId(collectionId === selectedCollectionId ? null : collectionId);
  };

  const handleCollectionUpdated = () => {
    // Collections list will reload its own data
    // This callback can be used to refresh pins if needed
  };

  // Filter to only public pins for the profile map, optionally by collection
  const publicPins = useMemo(() => {
    let filtered = pins.filter((pin) => pin.visibility === 'public');
    
    // Apply collection filter if one is selected
    if (selectedCollectionId) {
      filtered = filtered.filter((pin) => pin.collection_id === selectedCollectionId);
    }
    
    return filtered;
  }, [pins, selectedCollectionId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      {/* Left Column: Profile Card and Collections */}
      <div className="lg:col-span-3 space-y-3">
        <ProfileCard account={account} isOwnProfile={isOwnProfile} />
        <ProfileCollectionsList
          accountId={account.id}
          isOwnProfile={isOwnProfile}
          onCollectionUpdated={handleCollectionUpdated}
          selectedCollectionId={selectedCollectionId}
          onCollectionClick={handleCollectionClick}
        />
      </div>

      {/* Right Column: Mentions Section */}
      <div className="lg:col-span-9">
        <ProfileMentionsSection
          pins={pins}
          collections={collections}
          isOwnProfile={isOwnProfile}
          selectedCollectionId={selectedCollectionId}
          publicPins={publicPins}
          accountId={account.id}
          accountUsername={account.username}
          accountImageUrl={account.image_url}
        />
      </div>
    </div>
  );
}
