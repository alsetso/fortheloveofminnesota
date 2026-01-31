'use client';

import { MapIcon, ListBulletIcon } from '@heroicons/react/24/outline';

interface ProfileMentionsHeaderProps {
  viewMode: 'map' | 'list';
  onViewModeChange: (mode: 'map' | 'list') => void;
}

export default function ProfileMentionsHeader({
  viewMode,
  onViewModeChange,
}: ProfileMentionsHeaderProps) {
  return (
    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-gray-900">Mentions</h2>
      <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-md p-[2px]">
        <button
          onClick={() => onViewModeChange('map')}
          className={`flex items-center justify-center gap-1 px-1.5 h-[25px] text-[10px] font-medium rounded transition-colors ${
            viewMode === 'map'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          aria-label="Map view"
        >
          <MapIcon className="w-3 h-3" />
          <span>Map</span>
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`flex items-center justify-center gap-1 px-1.5 h-[25px] text-[10px] font-medium rounded transition-colors ${
            viewMode === 'list'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          aria-label="List view"
        >
          <ListBulletIcon className="w-3 h-3" />
          <span>List</span>
        </button>
      </div>
    </div>
  );
}
