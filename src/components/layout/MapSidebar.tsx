'use client';

import { ReactNode, useEffect, useState } from 'react';
import AppHeader from './AppHeader';
import HeaderMentionTypeCards from './HeaderMentionTypeCards';
import SearchContent from './SearchContent';
import NearbyPinsSection from './NearbyPinsSection';
import AllPinsSection from './AllPinsSection';
import { useHeaderTheme } from '@/contexts/HeaderThemeContext';
import { useSearchState } from '@/contexts/SearchStateContext';
import { useFooterStateManager } from './useFooterStateManager';
import { getFooterHeights } from './footerConfig';
import type { MapInstance, NearbyPin } from './types';

interface MapSidebarProps {
  /** Dynamic popup content shown in the sidebar (e.g. LivePinCard, MapInfo) */
  children?: ReactNode;
  /** Sidebar header label */
  headerLabel?: string;
  /** Whether the sidebar is open */
  isOpen?: boolean;
  /** Called when sidebar should close */
  onClose?: () => void;
  /** Called when sidebar should open (for toggle button) */
  onOpen?: () => void;
  /** Custom width (default: 320px) */
  width?: number;
  /** Show toggle button when closed (default: true) */
  showToggleWhenClosed?: boolean;
  /** Status accordion content (e.g. LiveMapFooterStatus) - shown at top */
  statusContent?: ReactNode;
  /** When set, account image in header opens this (e.g. AppMenu) instead of account dropdown */
  onAccountImageClick?: () => void;
  /** Map instance for nearby pins fetching */
  map?: MapInstance;
  /** Current zoom level */
  currentZoom?: number;
  /** Map center coordinates */
  mapCenter?: { lat: number; lng: number } | null;
  /** Programmatically set sidebar state: 'hidden' | 'tiny' | 'low' | 'main' | 'tall' */
  targetState?: 'hidden' | 'tiny' | 'low' | 'main' | 'tall' | null;
  /** Called when sidebar state changes */
  onStateChange?: (state: 'hidden' | 'tiny' | 'low' | 'main' | 'tall') => void;
  /** Universal close handler - clears selections */
  onUniversalClose?: () => void;
  /** Whether there's a selection active */
  hasSelection?: boolean;
  /** Whether a pin is selected */
  hasPinSelection?: boolean;
  /** Whether a location is selected */
  hasLocationSelection?: boolean;
  /** Whether a mention type filter is active */
  hasMentionTypeFilter?: boolean;
  /** Whether a modal is open */
  isModalOpen?: boolean;
  /** Callback when a location is selected (for flying to pin) */
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string) => void;
}

/**
 * Map Sidebar - Left sidebar that overlays the map
 * Near clone of AppFooter but adapted for vertical sidebar layout
 * Only visible on screens wider than 800px
 * When visible, the AppFooter should be hidden
 */
export default function MapSidebar({
  children,
  headerLabel = 'Map Sidebar',
  isOpen: controlledOpen = true,
  onClose,
  onOpen,
  width = 320,
  showToggleWhenClosed = true,
  statusContent,
  onAccountImageClick,
  map,
  currentZoom,
  mapCenter,
  targetState,
  onStateChange,
  onUniversalClose,
  hasSelection = false,
  hasPinSelection = false,
  hasLocationSelection = false,
  hasMentionTypeFilter = false,
  isModalOpen = false,
  onLocationSelect,
}: MapSidebarProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [internalOpen, setInternalOpen] = useState(true);
  const [nearbyPins, setNearbyPins] = useState<NearbyPin[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const { isSearchActive } = useHeaderTheme();

  // Check if screen is wider than 800px
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth > 800);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const { isSearching } = useSearchState();
  const isOpen = controlledOpen;
  const hasContent = children != null || nearbyPins.length > 0 || isSearchActive;

  // Get footer heights for state management
  const [footerHeights] = useState(() => getFooterHeights());
  const { HIDDEN_HEIGHT, TINY_HEIGHT, LOW_HEIGHT, MAIN_HEIGHT, TALL_HEIGHT } = footerHeights;

  // Use unified footer state manager (same logic as AppFooter)
  // Default to 'main' state when sidebar is open and no explicit targetState
  const effectiveTargetState = targetState !== null && targetState !== undefined 
    ? targetState 
    : isOpen && !isModalOpen 
      ? 'main' 
      : null;
  
  const stateManager = useFooterStateManager({
    isSearchActive,
    hasPinSelection,
    hasLocationSelection,
    hasMentionTypeFilter,
    isModalOpen,
    panelHeight: MAIN_HEIGHT, // Sidebar always uses main height
    targetState: effectiveTargetState,
    heights: { HIDDEN_HEIGHT, TINY_HEIGHT, LOW_HEIGHT, MAIN_HEIGHT, TALL_HEIGHT },
  });

  const currentState = stateManager.currentState;

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange && currentState) {
      onStateChange(currentState);
    }
  }, [currentState, onStateChange]);

  // Fetch nearby pins only when search is active (same as AppFooter)
  useEffect(() => {
    if (!isSearchActive || !mapCenter) {
      setNearbyPins([]);
      setLoadingNearby(false);
      return;
    }

    const fetchNearbyPins = async () => {
      setLoadingNearby(true);
      try {
        const radiusInKm = 20 * 1.60934;
        const response = await fetch(
          `/api/mentions/nearby?lat=${mapCenter.lat}&lng=${mapCenter.lng}&radius=${radiusInKm}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setNearbyPins((data.mentions || []).slice(0, 20) as NearbyPin[]);
        }
      } catch (err) {
        console.error('Error fetching nearby pins:', err);
        setNearbyPins([]);
      } finally {
        setLoadingNearby(false);
      }
    };

    const timeoutId = setTimeout(fetchNearbyPins, 300);
    return () => clearTimeout(timeoutId);
  }, [isSearchActive, mapCenter]);

  if (!isDesktop) {
    return null;
  }

  const isHidden = currentState === 'hidden';

  return (
    <>
      {/* Toggle button when sidebar is closed */}
      {!isOpen && showToggleWhenClosed && onOpen && (
        <button
          onClick={onOpen}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-[2001] bg-white border-r border-t border-b border-gray-200 rounded-r-md shadow-md p-2 hover:bg-gray-50 transition-colors"
          aria-label="Open map sidebar"
        >
          <svg
            className="w-4 h-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-[2000] bg-white border-r border-gray-200 shadow-lg transition-transform duration-300 ease-in-out overflow-hidden flex flex-col ${
          isOpen && !isHidden ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: `${width}px` }}
        data-container="map-sidebar"
        aria-label="Map sidebar"
        aria-hidden={isHidden}
      >
        {/* Status Content - Accordion (e.g. LiveMapFooterStatus) - shown at top */}
        {statusContent && (
          <div className="flex-shrink-0 px-[10px] pt-[10px] bg-gray-100">
            {statusContent}
          </div>
        )}

        {/* Header Content - Account dropdown, search, mention types */}
        <div className="flex-shrink-0 flex flex-col bg-white border-b border-gray-200">
          <div className="px-[10px]">
            <AppHeader 
              onAccountImageClick={onAccountImageClick}
              onUniversalClose={onUniversalClose}
              showCloseIcon={stateManager.shouldShowCloseIcon}
              currentFooterState={currentState}
              map={map}
              onLocationSelect={onLocationSelect}
            />
          </div>
          {stateManager.shouldShowMentionTypes && !isSearching && (
            <div className="px-[10px]">
              <HeaderMentionTypeCards />
            </div>
          )}
        </div>

        {/* Content area (scrollable) */}
        {currentState !== 'hidden' && (
          <div
            className="flex-1 overflow-y-auto min-h-0"
            data-container="map-sidebar-content"
          >
            {/* Tall state: Search content or live pin card */}
            {currentState === 'tall' ? (
              <>
                {isSearchActive ? (
                  <SearchContent
                    onPinClick={(coords) => {
                      window.dispatchEvent(
                        new CustomEvent('live-search-pin-select', {
                          detail: coords,
                        })
                      );
                    }}
                  />
                ) : (
                  // Live pin card content is passed as children when in tall state
                  children
                )}
              </>
            ) : (
              <>
                {/* Main state or low state: Show all pins or children */}
                {(currentState === 'main' || currentState === 'low') && (
                  <>
                    {/* Show search content when searching */}
                    {isSearchActive ? (
                      <SearchContent
                        onCityClick={(coords) => {
                          window.dispatchEvent(
                            new CustomEvent('live-search-pin-select', {
                              detail: coords,
                            })
                          );
                        }}
                      />
                    ) : (
                      <>
                        {/* Main action container - show when there's a selection */}
                        {(hasPinSelection || hasLocationSelection || hasMentionTypeFilter) && children && (
                          <div className="flex-shrink-0">
                            {children}
                          </div>
                        )}
                        
                        {/* All pins section - always show in main/low state when no selection and not searching */}
                        {!isSearching && (!hasPinSelection && !hasLocationSelection && !hasMentionTypeFilter) && (
                          <AllPinsSection limit={50} />
                        )}
                        
                        {/* Nearby pins section (when there's a selection and children exist) - hide when searching */}
                        {!isSearching && (hasPinSelection || hasLocationSelection || hasMentionTypeFilter) && children && (
                          <NearbyPinsSection pins={nearbyPins} loading={loadingNearby} />
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
