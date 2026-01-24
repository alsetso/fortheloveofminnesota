'use client';

import SidebarHeaderButtons from '@/components/layout/SidebarHeaderButtons';

interface LivePageHeaderButtonsProps {
  onSettingsClick: () => void;
  onFilterClick: () => void;
}

export default function LivePageHeaderButtons({ onSettingsClick, onFilterClick }: LivePageHeaderButtonsProps) {
  return (
    <SidebarHeaderButtons
      onFilterClick={onFilterClick}
      onSettingsClick={onSettingsClick}
      filterLabel="Filter mention types"
      settingsLabel="Map settings"
    />
  );
}
