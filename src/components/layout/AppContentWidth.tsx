'use client';

import { ReactNode, useEffect } from 'react';
import { useHeaderTheme } from '@/contexts/HeaderThemeContext';
import AppFooter from './AppFooter';
import LiveSearch from './LiveSearch';

interface AppContentWidthProps {
  /** Dynamic content for the app footer popup (above the footer header) */
  footerContent?: ReactNode;
  /** Label for the footer header bar (always at bottom) */
  footerHeaderLabel?: string;
  /** Controlled footer open state (optional) */
  footerOpen?: boolean;
  /** Called when footer open state changes (optional) */
  onFooterOpenChange?: (open: boolean) => void;
  /** Transparent section above the white footer (e.g. map loading states) */
  footerStatusContent?: ReactNode;
  /** When set, account image in header opens this (e.g. AppMenu) instead of account dropdown */
  onAccountImageClick?: () => void;
  /** Map instance for nearby pins fetching */
  map?: import('./types').MapInstance;
  /** Current zoom level */
  currentZoom?: number;
  /** Map center coordinates */
  mapCenter?: { lat: number; lng: number } | null;
  /** Programmatically set footer state: 'hidden' | 'low' | 'main' | 'tall' */
  footerTargetState?: 'hidden' | 'low' | 'main' | 'tall' | null;
  /** Called when footer state changes */
  onFooterStateChange?: (state: 'hidden' | 'low' | 'main' | 'tall') => void;
  /** Universal close handler - clears selections and collapses footer */
  onUniversalClose?: () => void;
  /** Whether there's a selection active (determines if close icon should show) */
  hasSelection?: boolean;
  /** Whether a pin is selected */
  hasPinSelection?: boolean;
  /** Whether a location is selected */
  hasLocationSelection?: boolean;
  /** Whether a mention type filter is active */
  hasMentionTypeFilter?: boolean;
  /** Whether a modal is open (should hide footer) */
  isModalOpen?: boolean;
}

/**
 * Overlay container (max-width 500px, 100dvh) over the map.
 * Header (account + search + mention types) is now inside the footer panel.
 * Footer slides up iOS Maps-style with draggable handle.
 * When #search, LiveSearch overlay covers everything.
 */
export default function AppContentWidth({
  footerContent,
  footerHeaderLabel = 'Footer',
  footerOpen,
  onFooterOpenChange,
  footerStatusContent,
  onAccountImageClick,
  map,
  currentZoom,
  mapCenter,
  footerTargetState,
  onFooterStateChange,
  onUniversalClose,
  hasSelection,
  hasPinSelection,
  hasLocationSelection,
  hasMentionTypeFilter,
  isModalOpen = false,
}: AppContentWidthProps) {
  const { isSearchActive } = useHeaderTheme();
  
  // Hide native Mapbox controls when search is active
  useEffect(() => {
    const styleId = 'hide-mapbox-controls';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
    
    if (isSearchActive) {
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
          .mapboxgl-ctrl-top-right { display: none !important; }
        `;
        document.head.appendChild(styleElement);
      }
    } else {
      if (styleElement) {
        styleElement.remove();
      }
    }
    
    return () => {
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, [isSearchActive]);

  return (
    <>
      <div
        className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-full max-w-[500px] flex flex-col pointer-events-none z-[2010]"
        style={{ maxWidth: '500px', height: '100dvh' }}
        data-container="app-content-width"
        aria-label="App content width"
      >
      <div className="flex-1 min-h-0 relative flex flex-col">
        <div
          className="flex-1 min-h-0 pointer-events-none"
          data-container="map-interaction-area"
          aria-hidden
        />
        <div className="pointer-events-auto flex-shrink-0 flex flex-col">
          <AppFooter
            headerLabel={footerHeaderLabel}
            isOpen={footerOpen}
            onOpenChange={onFooterOpenChange}
            hideSpacer={footerStatusContent != null}
            statusContent={footerStatusContent}
            onAccountImageClick={onAccountImageClick}
            map={map}
            currentZoom={currentZoom}
            mapCenter={mapCenter}
            targetState={footerTargetState}
            onStateChange={onFooterStateChange}
            onUniversalClose={onUniversalClose}
            hasSelection={hasSelection}
            hasPinSelection={hasPinSelection}
            hasLocationSelection={hasLocationSelection}
            hasMentionTypeFilter={hasMentionTypeFilter}
            isModalOpen={isModalOpen}
          >
            {footerContent}
          </AppFooter>
        </div>
      </div>
      </div>
    </>
  );
}
