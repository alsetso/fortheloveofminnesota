'use client';

import { UsersIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import SidebarHeaderButtons from '@/components/layout/SidebarHeaderButtons';
import SidebarToggleButton from '@/components/layout/SidebarToggleButton';

interface MapPageHeaderButtonsProps {
  onSettingsClick: () => void;
  onFilterClick: () => void;
  onMembersClick: () => void;
  onPostsClick: () => void;
  showSettings: boolean;
  showMembers: boolean;
  showPosts: boolean;
  showFilter?: boolean;
}

export default function MapPageHeaderButtons({ 
  onSettingsClick, 
  onFilterClick, 
  onMembersClick,
  onPostsClick,
  showSettings,
  showMembers,
  showPosts,
  showFilter = false,
}: MapPageHeaderButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <SidebarHeaderButtons
        onFilterClick={onFilterClick}
        onSettingsClick={onSettingsClick}
        showFilter={showFilter}
        showSettings={showSettings}
        filterLabel="Filter map"
        settingsLabel="Map settings"
      />
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
