'use client';

import { ComponentType } from 'react';
import { Cog6ToothIcon, FunnelIcon } from '@heroicons/react/24/outline';
import SidebarToggleButton from './SidebarToggleButton';

interface SidebarHeaderButtonsProps {
  onFilterClick: () => void;
  onSettingsClick: () => void;
  /** Show the settings button. Default: true */
  showSettings?: boolean;
  /** Custom filter icon. Default: FunnelIcon */
  filterIcon?: ComponentType<{ className?: string }>;
  /** Custom settings icon. Default: Cog6ToothIcon */
  settingsIcon?: ComponentType<{ className?: string }>;
  /** Custom filter label. Default: 'Filter' */
  filterLabel?: string;
  /** Custom settings label. Default: 'Settings' */
  settingsLabel?: string;
}

/**
 * Unified sidebar header buttons component.
 * 
 * Provides consistent filter and settings toggle buttons for pages with sidebars.
 * Replaces LivePageHeaderButtons and MapPageHeaderButtons.
 * 
 * @example
 * ```tsx
 * <SidebarHeaderButtons
 *   onFilterClick={toggleFilter}
 *   onSettingsClick={toggleSettings}
 *   showSettings={isOwner}
 * />
 * ```
 */
export default function SidebarHeaderButtons({
  onFilterClick,
  onSettingsClick,
  showSettings = true,
  filterIcon: FilterIcon = FunnelIcon,
  settingsIcon: SettingsIcon = Cog6ToothIcon,
  filterLabel = 'Filter',
  settingsLabel = 'Settings',
}: SidebarHeaderButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <SidebarToggleButton
        icon={FilterIcon}
        onClick={onFilterClick}
        ariaLabel={filterLabel}
        title={filterLabel}
      />
      {showSettings && (
        <SidebarToggleButton
          icon={SettingsIcon}
          onClick={onSettingsClick}
          ariaLabel={settingsLabel}
          title={settingsLabel}
        />
      )}
    </div>
  );
}
