'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import MentionTypeFilterContent from '@/components/layout/MentionTypeFilterContent';
import MentionTypeFilterPopup from '@/components/layout/MentionTypeFilterPopup';
import MapSettingsContent from '@/components/layout/MapSettingsContent';
import BottomButtonsPopup from '@/components/layout/BottomButtonsPopup';

interface LivePageLayoutProps {
  children: React.ReactNode;
  map: any;
  timeFilter: '24h' | '7d' | 'all';
  onTimeFilterChange: (filter: '24h' | '7d' | 'all') => void;
  onUpgrade: () => void;
  onProToast: (feature?: string) => void;
  districtsState?: {
    showDistricts: boolean;
    setShowDistricts: (show: boolean) => void;
  };
  ctuState?: {
    showCTU: boolean;
    setShowCTU: (show: boolean) => void;
  };
  stateBoundaryState?: {
    showStateBoundary: boolean;
    setShowStateBoundary: (show: boolean) => void;
  };
  countyBoundariesState?: {
    showCountyBoundaries: boolean;
    setShowCountyBoundaries: (show: boolean) => void;
  };
  isFilterOpen: boolean;
  isSettingsOpen: boolean;
  onFilterToggle: () => void;
  onSettingsToggle: () => void;
}

export default function LivePageLayout({
  children,
  map,
  timeFilter,
  onTimeFilterChange,
  onUpgrade,
  onProToast,
  districtsState,
  ctuState,
  stateBoundaryState,
  countyBoundariesState,
  isFilterOpen,
  isSettingsOpen,
  onFilterToggle,
  onSettingsToggle,
}: LivePageLayoutProps) {
  return (
    <div className="relative w-full h-full flex">
      {/* Mobile: Slide-up modals */}
      <div className="lg:hidden">
        <MentionTypeFilterPopup
          isOpen={isFilterOpen}
          onClose={onFilterToggle}
        />

        <BottomButtonsPopup
          isOpen={isSettingsOpen}
          onClose={onSettingsToggle}
          type="settings"
          height="full"
          darkMode={true}
        >
          <MapSettingsContent
            map={map}
            timeFilter={timeFilter}
            onTimeFilterChange={onTimeFilterChange}
            onUpgrade={onUpgrade}
            onProToast={onProToast}
            darkMode={true}
            districtsState={districtsState}
            ctuState={ctuState}
            stateBoundaryState={stateBoundaryState}
            countyBoundariesState={countyBoundariesState}
          />
        </BottomButtonsPopup>
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
                  <h2 className="text-sm font-semibold text-gray-900">Filter Mentions</h2>
                  <button
                    onClick={onFilterToggle}
                    className="flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    aria-label="Close filters"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  <MentionTypeFilterContent onClose={onFilterToggle} />
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Center: Map */}
        <main className="flex-1 min-w-0 relative">
          {children}
        </main>

        {/* Right Sidebar: Settings */}
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
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  <MapSettingsContent
                    map={map}
                    timeFilter={timeFilter}
                    onTimeFilterChange={onTimeFilterChange}
                    onUpgrade={onUpgrade}
                    onProToast={onProToast}
                    darkMode={false}
                    districtsState={districtsState}
                    ctuState={ctuState}
                    stateBoundaryState={stateBoundaryState}
                    countyBoundariesState={countyBoundariesState}
                  />
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
