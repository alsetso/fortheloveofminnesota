'use client';

import { useState } from 'react';
import ProfileCard from './ProfileCard';
import ProfileSidebarNav from './ProfileSidebarNav';
import ProfileTopbar from './ProfileTopbar';
import ProfileMapsContainer from './ProfileMapsContainer';
import ProfileMentionsContainer from './ProfileMentionsContainer';
import ProfileMentionsList from './ProfileMentionsList';
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
  return plan === 'contributor' || plan === 'plus';
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
  const [activeTab, setActiveTab] = useState<'maps' | 'mentions' | 'list'>(shouldShowMapsTab ? 'maps' : 'mentions');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleSidebarToggle = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'maps':
        return (
          <ProfileMapsContainer 
            accountId={account.id} 
            isOwnProfile={isOwnProfile}
            accountPlan={account.plan}
          />
        );
      case 'list':
        return (
          <ProfileMentionsList 
            pins={pins} 
            isOwnProfile={isOwnProfile}
            onViewMap={() => setActiveTab('mentions')}
          />
        );
      default:
        return (
          <ProfileMentionsContainer
            pins={pins}
            accountId={account.id}
            isOwnProfile={isOwnProfile}
            accountUsername={account.username}
            accountImageUrl={account.image_url}
            collections={collections}
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#f4f2ef]">
      {/* Top Navigation Bar - Full Width, Sticky */}
      <header className="sticky top-0 z-50 flex-shrink-0 w-full">
        <ProfileTopbar 
          profileUsername={account.username}
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={handleSidebarToggle}
        />
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 w-full relative">
        {/* Mobile Overlay Backdrop */}
        {isSidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-40 top-14"
            onClick={handleSidebarToggle}
            aria-hidden="true"
          />
        )}

        <div className="flex flex-col lg:flex-row h-full">
          {/* Left Sidebar - Profile Card & Navigation */}
          <aside 
            className={`
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              lg:translate-x-0
              ${isSidebarOpen ? 'lg:block' : 'lg:hidden'}
              fixed lg:sticky
              top-14
              left-0
              w-64 xl:w-80
              h-[calc(100vh-3.5rem)]
              flex-shrink-0 
              bg-white 
              border-r 
              border-gray-200
              overflow-y-auto
              z-50 lg:z-auto
              transition-transform duration-300 ease-in-out
              lg:transition-none
            `}
          >
            <div className="p-3 space-y-3">
              <ProfileCard account={account} isOwnProfile={isOwnProfile} hideTopSection={true} />
              <ProfileSidebarNav 
                accountUsername={account.username}
                accountPlan={account.plan}
                isOwnProfile={isOwnProfile}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
          </aside>

          {/* Main Content Area - Tab Content */}
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {renderTabContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
