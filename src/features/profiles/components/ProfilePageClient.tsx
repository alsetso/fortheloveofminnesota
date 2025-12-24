'use client';

import ProfileCard from './ProfileCard';
import ProfileMentionsSection from './ProfileMentionsSection';
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
  return (
    <div className="space-y-3">
      <ProfileCard account={account} isOwnProfile={isOwnProfile} />
      <ProfileMentionsSection
        pins={pins}
        collections={collections}
        isOwnProfile={isOwnProfile}
      />
    </div>
  );
}
