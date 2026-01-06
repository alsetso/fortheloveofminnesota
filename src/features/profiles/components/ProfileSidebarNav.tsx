'use client';

import { MapIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface ProfileSidebarNavProps {
  accountUsername: string | null;
  accountPlan?: string | null;
  isOwnProfile?: boolean;
  activeTab: 'maps' | 'mentions';
  onTabChange: (tab: 'maps' | 'mentions') => void;
}

// Helper to check if plan is pro
const isProPlan = (plan: string | null | undefined): boolean => {
  return plan === 'pro' || plan === 'plus';
};

export default function ProfileSidebarNav({ accountUsername, accountPlan, isOwnProfile = false, activeTab, onTabChange }: ProfileSidebarNavProps) {
  // Show Maps tab to owner always, or to visitors if owner has pro plan
  const profileOwnerIsPro = isProPlan(accountPlan);
  const shouldShowMapsTab = isOwnProfile || profileOwnerIsPro;
  
  return (
    <div className="bg-white rounded-md border border-gray-200 p-[10px]">
      <nav className="space-y-1">
        {/* Show Maps tab to owner always, or to visitors if owner has pro plan */}
        {shouldShowMapsTab && (
          <button
            onClick={() => onTabChange('maps')}
            className={`w-full flex items-center gap-2 px-[10px] py-[10px] rounded-md text-xs font-medium transition-colors ${
              activeTab === 'maps'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span>Maps</span>
          </button>
        )}
        <button
          onClick={() => onTabChange('mentions')}
          className={`w-full flex items-center gap-2 px-[10px] py-[10px] rounded-md text-xs font-medium transition-colors ${
            activeTab === 'mentions'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <MapPinIcon className="w-4 h-4" />
          <span>Mentions</span>
        </button>
      </nav>
    </div>
  );
}

