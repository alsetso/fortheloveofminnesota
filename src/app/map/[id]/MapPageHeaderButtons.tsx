'use client';

import SidebarHeaderButtons from '@/components/layout/SidebarHeaderButtons';

interface MapPageHeaderButtonsProps {
  onSettingsClick: () => void;
  onFilterClick: () => void;
  showSettings: boolean;
}

export default function MapPageHeaderButtons({ onSettingsClick, onFilterClick, showSettings }: MapPageHeaderButtonsProps) {
  return (
    <SidebarHeaderButtons
      onFilterClick={onFilterClick}
      onSettingsClick={onSettingsClick}
      showSettings={showSettings}
      filterLabel="Filter map"
      settingsLabel="Map settings"
    />
  );
}
