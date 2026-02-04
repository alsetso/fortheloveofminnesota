'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useHeaderTheme } from '@/contexts/HeaderThemeContext';
import { useSearchState } from '@/contexts/SearchStateContext';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import MapSearchInput from './MapSearchInput';

interface AppHeaderProps {
  /** When set, account image click opens this (e.g. AppMenu) instead of the account dropdown */
  onAccountImageClick?: () => void;
  /** Universal close handler - closes search, clears selections, collapses footer */
  onUniversalClose?: () => void;
  /** Whether to show the universal close icon (when search is active or selection exists) */
  showCloseIcon?: boolean;
  /** Current footer state - used for reactive styling */
  currentFooterState?: 'hidden' | 'tiny' | 'low' | 'main' | 'tall';
  /** Map instance for flying to locations */
  map?: any;
  /** Callback when a location is selected */
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: any) => void;
}

/**
 * App header for the live overlay: account image + search.
 */
export default function AppHeader({ onAccountImageClick, onUniversalClose, showCloseIcon, currentFooterState, map, onLocationSelect }: AppHeaderProps) {
  const { isSearchActive } = useHeaderTheme();
  const { deactivateSearch, clearSearch } = useSearchState();
  
  // Determine if search input should show active styling
  const isSearchInputActive = isSearchActive || currentFooterState === 'tall';

  const handleClose = () => {
    // Close search if active
    if (isSearchActive) {
      clearSearch();
    }
    // Call universal close handler (clears selections, collapses footer)
    onUniversalClose?.();
  };

  return (
    <header
      className={`flex-shrink-0 flex items-center gap-2 py-[10px] ${isSearchActive ? 'bg-white' : ''}`}
      data-container="app-header"
      aria-label="App header"
    >
      <div className="flex-1 min-w-0">
        <MapSearchInput 
          map={map}
          onLocationSelect={onLocationSelect}
          isActive={isSearchInputActive} 
        />
      </div>
      <div className="flex-shrink-0">
        <AccountDropdown variant="light" onTriggerClick={onAccountImageClick} />
      </div>
      {showCloseIcon && (
        <button
          type="button"
          onClick={handleClose}
          className="flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </header>
  );
}
