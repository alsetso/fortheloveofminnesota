'use client';

import { useState } from 'react';
import ProfileMentionsHeader from '@/features/profiles/components/ProfileMentionsHeader';
import ProfileMentionsContainer from '@/features/profiles/components/ProfileMentionsContainer';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';

interface ProfileMentionsSectionProps {
  pins: ProfilePin[];
  accountId: string;
  isOwnProfile: boolean;
  accountUsername: string | null;
  accountImageUrl: string | null;
  collections: Collection[];
}

export default function ProfileMentionsSection({
  pins,
  accountId,
  isOwnProfile,
  accountUsername,
  accountImageUrl,
  collections,
}: ProfileMentionsSectionProps) {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <ProfileMentionsHeader viewMode={viewMode} onViewModeChange={setViewMode} />
      <ProfileMentionsContainer
        pins={pins}
        accountId={accountId}
        isOwnProfile={isOwnProfile}
        accountUsername={accountUsername}
        accountImageUrl={accountImageUrl}
        collections={collections}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}
