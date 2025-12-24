'use client';

import { useState } from 'react';
import ProfileCard from './ProfileCard';
import ProfileMentionsSection from './ProfileMentionsSection';
import ProfileCollectionsList from './ProfileCollectionsList';
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
    setSelectedCollectionId(prev => prev === collectionId ? null : collectionId);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      {/* Left Column - Profile Card and Collections */}
      <div className="lg:col-span-4 space-y-3">
        <ProfileCard 
          account={account}
          isOwnProfile={isOwnProfile}
        />
        <ProfileCollectionsList 
          accountId={account.id}
          isOwnProfile={isOwnProfile}
          selectedCollectionId={selectedCollectionId}
          onCollectionClick={handleCollectionClick}
        />
      </div>

      {/* Right Column - Mentions Section */}
      <div className="lg:col-span-8">
        <ProfileMentionsSection 
          pins={pins} 
          collections={collections}
          isOwnProfile={isOwnProfile}
          selectedCollectionId={selectedCollectionId}
        />
      </div>
    </div>
  );
}

