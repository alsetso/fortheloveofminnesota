'use client';

import { MapIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface ProfileSidebarNavProps {
  accountUsername: string | null;
  activeTab: 'maps' | 'mentions';
  onTabChange: (tab: 'maps' | 'mentions') => void;
}

export default function ProfileSidebarNav({ accountUsername, activeTab, onTabChange }: ProfileSidebarNavProps) {
  return (
    <div className="bg-white rounded-md border border-gray-200 p-[10px]">
      <nav className="space-y-1">
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

