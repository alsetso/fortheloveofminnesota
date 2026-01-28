'use client';

import SidebarHeaderButtons from '@/components/layout/SidebarHeaderButtons';

interface MapPageHeaderButtonsProps {
  onSettingsClick: () => void;
  onFilterClick: () => void;
  showSettings: boolean;
  showFilter?: boolean;
}

export default function MapPageHeaderButtons({ 
  onSettingsClick, 
  onFilterClick, 
  showSettings,
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
    </div>
  );
}
