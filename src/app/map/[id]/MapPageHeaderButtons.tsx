'use client';

import { UsersIcon, UserPlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import SidebarHeaderButtons from '@/components/layout/SidebarHeaderButtons';
import SidebarToggleButton from '@/components/layout/SidebarToggleButton';

interface MapPageHeaderButtonsProps {
  onSettingsClick: () => void;
  onFilterClick: () => void;
  onMembersClick: () => void;
  onJoinClick: () => void;
  onPostsClick: () => void;
  showSettings: boolean;
  showMembers: boolean;
  showJoin: boolean;
  showPosts: boolean;
}

export default function MapPageHeaderButtons({ 
  onSettingsClick, 
  onFilterClick, 
  onMembersClick,
  onJoinClick,
  onPostsClick,
  showSettings,
  showMembers,
  showJoin,
  showPosts,
}: MapPageHeaderButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <SidebarHeaderButtons
        onFilterClick={onFilterClick}
        onSettingsClick={onSettingsClick}
        showFilter={false}
        showSettings={showSettings}
        filterLabel="Filter map"
        settingsLabel="Map settings"
      />
      {showJoin && (
        <div className="relative">
          <SidebarToggleButton
            icon={UserPlusIcon}
            onClick={onJoinClick}
            ariaLabel="Join map"
            title="Join map"
          />
          {/* Red circle indicator for non-members */}
          <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white" />
        </div>
      )}
      {showMembers && (
        <SidebarToggleButton
          icon={UsersIcon}
          onClick={onMembersClick}
          ariaLabel="Map members"
          title="Map members"
        />
      )}
      {showPosts && (
        <SidebarToggleButton
          icon={DocumentTextIcon}
          onClick={onPostsClick}
          ariaLabel="Map posts"
          title="Map posts"
        />
      )}
    </div>
  );
}
