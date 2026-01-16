'use client';

import { useState } from 'react';
import ProfileCard from './ProfileCard';
import ProfileSidebarNav from './ProfileSidebarNav';
import ProfileMapsContainer from './ProfileMapsContainer';
import ProfileMentionsContainer from './ProfileMentionsContainer';
import ProfileMentionsList from './ProfileMentionsList';
import ProfileCollectionsContainer from './ProfileCollectionsContainer';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';

interface ProfilePageClientProps {
  account: ProfileAccount;
  pins: ProfilePin[];
  collections: Collection[];
  isOwnProfile: boolean;
}

// Helper to check if plan is pro
const isProPlan = (plan: string | null | undefined): boolean => {
  return plan === 'pro' || plan === 'plus';
};

export default function ProfilePageClient({
  account,
  pins,
  collections,
  isOwnProfile,
}: ProfilePageClientProps) {
  // Show maps tab to owner always, or to visitors if owner has pro plan
  const profileOwnerIsPro = isProPlan(account.plan);
  const shouldShowMapsTab = isOwnProfile || profileOwnerIsPro;
  const [activeTab, setActiveTab] = useState<'maps' | 'mentions' | 'list' | 'collections'>(shouldShowMapsTab ? 'maps' : 'mentions');
  
  // Handle collections update to refresh mentions container
  const handleCollectionsUpdate = () => {
    // Collections update will be handled by the container itself
    // This is just a placeholder for future use if needed
  };

  return (
    <div className="space-y-3">
      {/* Left Nav and Content Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Sidebar Navigation */}
        <div className="lg:col-span-3 space-y-3">
          {/* Profile Card - Above sidebar */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <ProfileCard account={account} isOwnProfile={isOwnProfile} />
          </div>
          
          {/* Sidebar Navigation */}
          <ProfileSidebarNav 
            accountUsername={account.username}
            accountPlan={account.plan}
            isOwnProfile={isOwnProfile}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Right Content: Maps, Mentions, List, or Collections */}
        <div className="lg:col-span-9">
          {activeTab === 'maps' ? (
            <ProfileMapsContainer 
              accountId={account.id} 
              isOwnProfile={isOwnProfile}
              accountPlan={account.plan}
            />
          ) : activeTab === 'list' ? (
            <ProfileMentionsList 
              pins={pins} 
              isOwnProfile={isOwnProfile}
              onViewMap={() => setActiveTab('mentions')}
            />
          ) : activeTab === 'collections' ? (
            <ProfileCollectionsContainer
              accountId={account.id}
              isOwnProfile={isOwnProfile}
              onCollectionsUpdate={handleCollectionsUpdate}
            />
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
