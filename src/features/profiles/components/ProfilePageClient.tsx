'use client';

import { useState } from 'react';
import ProfileCard from './ProfileCard';
import ProfileSidebarNav from './ProfileSidebarNav';
import ProfileMapsContainer from './ProfileMapsContainer';
import ProfileMentionsContainer from './ProfileMentionsContainer';
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
  const [activeTab, setActiveTab] = useState<'maps' | 'mentions'>('maps');

  return (
    <div className="space-y-3">
      {/* Profile Card - Expanded to use full width */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <ProfileCard account={account} isOwnProfile={isOwnProfile} />
      </div>

      {/* Coming Soon Message */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600 text-center">
          Many additional profile features coming soon–with your support so share our platform
        </p>
      </div>

      {/* Left Nav and Content Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Sidebar Navigation */}
        <div className="lg:col-span-3">
          <ProfileSidebarNav 
            accountUsername={account.username} 
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Right Content: Maps or Mentions */}
        <div className="lg:col-span-9">
          {activeTab === 'maps' ? (
            <ProfileMapsContainer accountId={account.id} isOwnProfile={isOwnProfile} />
          ) : (
            <ProfileMentionsContainer
              pins={pins}
              accountId={account.id}
              isOwnProfile={isOwnProfile}
              accountUsername={account.username}
              accountImageUrl={account.image_url}
              collections={collections}
            />
          )}
        </div>
      </div>
    </div>
  );
}
