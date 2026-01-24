'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import MapFilterContent from '@/components/layout/MapFilterContent';
import BottomButtonsPopup from '@/components/layout/BottomButtonsPopup';
import MapSettingsSidebar from './components/MapSettingsSidebar';

interface MapPageLayoutProps {
  children: React.ReactNode;
  initialMap: {
    id: string;
    account_id: string;
    title: string;
    description: string | null;
    visibility: 'public' | 'private' | 'shared';
    map_style: 'street' | 'satellite' | 'light' | 'dark';
    map_layers?: Record<string, boolean> | null;
    type?: 'user' | 'community' | 'gov' | 'professional' | 'atlas' | 'user-generated' | null;
    collection_type?: 'community' | 'professional' | 'user' | 'atlas' | 'gov' | null;
    custom_slug?: string | null;
    is_primary?: boolean;
    hide_creator?: boolean;
    tags?: Array<{ emoji: string; text: string }> | null;
    meta?: {
      buildingsEnabled?: boolean;
      pitch?: number;
      terrainEnabled?: boolean;
      center?: [number, number];
      zoom?: number;
    } | null;
    created_at: string;
    updated_at: string;
  };
  onMapUpdated?: (updatedMap: any) => void;
  isFilterOpen: boolean;
  isSettingsOpen: boolean;
  onFilterToggle: () => void;
  onSettingsToggle: () => void;
  showSettings: boolean; // Only show settings if owner
}

export default function MapPageLayout({
  children,
  initialMap,
  onMapUpdated,
  isFilterOpen,
  isSettingsOpen,
  onFilterToggle,
  onSettingsToggle,
  showSettings,
}: MapPageLayoutProps) {
  return (
    <div className="relative w-full h-full flex">
      {/* Mobile: Slide-up modals */}
      <div className="lg:hidden">
        <BottomButtonsPopup
          isOpen={isFilterOpen}
          onClose={onFilterToggle}
          type="search"
          height="full"
          darkMode={true}
        >
          <div className="p-4">
            <MapFilterContent />
          </div>
        </BottomButtonsPopup>

        {showSettings && (
          <BottomButtonsPopup
            isOpen={isSettingsOpen}
            onClose={onSettingsToggle}
            type="settings"
            height="full"
            darkMode={true}
          >
            <MapSettingsSidebar
              initialMap={initialMap}
              onUpdated={onMapUpdated}
            />
          </BottomButtonsPopup>
        )}
      </div>

      {/* Desktop: Three-column layout */}
      <div className="hidden lg:flex w-full h-full">
        {/* Left Sidebar: Filters */}
        <aside
          className={`${
            isFilterOpen ? 'w-80' : 'w-0'
          } transition-all duration-300 ease-in-out flex-shrink-0 bg-white border-r border-gray-200 overflow-hidden`}
        >
          <div className="h-full flex flex-col">
            {isFilterOpen && (
              <>
                <div className="flex items-center justify-between p-3 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900">Filter Map</h2>
                  <button
                    onClick={onFilterToggle}
                    className="flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    aria-label="Close filters"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <MapFilterContent />
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Center: Map */}
        <main className="flex-1 min-w-0 relative">
          {children}
        </main>

        {/* Right Sidebar: Settings (only if owner) */}
        {showSettings && (
          <aside
            className={`${
              isSettingsOpen ? 'w-80' : 'w-0'
            } transition-all duration-300 ease-in-out flex-shrink-0 bg-white border-l border-gray-200 overflow-hidden`}
          >
            <div className="h-full flex flex-col">
              {isSettingsOpen && (
                <>
                  <div className="flex items-center justify-between p-3 border-b border-gray-200">
                    <h2 className="text-sm font-semibold text-gray-900">Map Settings</h2>
                    <button
                      onClick={onSettingsToggle}
                      className="flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      aria-label="Close settings"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <MapSettingsSidebar
                      initialMap={initialMap}
                      onUpdated={onMapUpdated}
                    />
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
