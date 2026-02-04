'use client';

import { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import AppHeader from './AppHeader';
import HeaderMentionTypeCards from './HeaderMentionTypeCards';
import SearchContent from './SearchContent';
import NearbyPinsSection from './NearbyPinsSection';
import { useHeaderTheme } from '@/contexts/HeaderThemeContext';
import { useSearchState } from '@/contexts/SearchStateContext';
import { getFooterHeights, type FooterState } from './footerConfig';
import { useFooterStateManager } from './useFooterStateManager';
import type { MapInstance, NearbyPin } from './types';

interface AppFooterProps {
  /** Dynamic popup content shown above the footer header */
  children?: ReactNode;
  /** Footer header label (always visible at bottom) */
  headerLabel?: string;
  /** Controlled open state (optional) */
  isOpen?: boolean;
  /** Called when open state should change (optional, for controlled mode) */
  onOpenChange?: (open: boolean) => void;
  /** Hide the spacer below the header (useful when status content is above) */
  hideSpacer?: boolean;
  /** Status accordion content (e.g. LiveMapFooterStatus) - shown above header */
  statusContent?: ReactNode;
  /** When set, account image in header opens this (e.g. AppMenu) instead of account dropdown */
  onAccountImageClick?: () => void;
  /** Map instance for nearby pins fetching */
  map?: MapInstance;
  /** Current zoom level */
  currentZoom?: number;
  /** Map center coordinates */
  mapCenter?: { lat: number; lng: number } | null;
  /** Programmatically set footer state: 'hidden' | 'tiny' | 'low' | 'main' | 'tall' */
  targetState?: 'hidden' | 'tiny' | 'low' | 'main' | 'tall' | null;
  /** Called when footer state changes */
  onStateChange?: (state: 'hidden' | 'tiny' | 'low' | 'main' | 'tall') => void;
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
  /** Callback when a location is selected */
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: any) => void;
}

/**
 * iOS Maps-style slide-up panel footer.
 * Draggable/resizable panel that slides up from bottom.
 * Header contains: account dropdown, search, mention types.
 * Shows nearby pins when zoomed in or searching.
 */
export default function AppFooter({ 
  children, 
  headerLabel = 'Footer', 
  isOpen: controlledOpen, 
  onOpenChange, 
  hideSpacer = false,
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
}: AppFooterProps) {
  const { isSearchActive } = useHeaderTheme();
  const { isSearching } = useSearchState();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const [nearbyPins, setNearbyPins] = useState<NearbyPin[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  
  // Get footer heights from config - use state to avoid hydration mismatch
  // Initialize with safe defaults, update after mount
  const [footerHeights, setFooterHeights] = useState(() => getFooterHeights());
  
  useEffect(() => {
    // Update heights after mount to match actual viewport
    setFooterHeights(getFooterHeights());
  }, []);
  
  const { HIDDEN_HEIGHT, TINY_HEIGHT, LOW_HEIGHT, MAIN_HEIGHT, TALL_HEIGHT } = footerHeights;
  
  // Panel height state - initialize to LOW_HEIGHT
  const [panelHeight, setPanelHeight] = useState(LOW_HEIGHT);
  
  // Track if user is manually dragging (to prevent targetState from overriding manual drag)
  const isManualDragRef = useRef(false);
  
  const isControlled = controlledOpen !== undefined && onOpenChange != null;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;
  const hasContent = children != null || nearbyPins.length > 0 || isSearchActive;
  
  // Use unified footer state manager
  const stateManager = useFooterStateManager({
    isSearchActive,
    hasPinSelection,
    hasLocationSelection,
    hasMentionTypeFilter,
    isModalOpen,
    panelHeight,
    targetState,
    heights: { HIDDEN_HEIGHT, TINY_HEIGHT, LOW_HEIGHT, MAIN_HEIGHT, TALL_HEIGHT },
  });
  
  const currentState = stateManager.currentState;

  // Respond to programmatic targetState changes (from map clicks, close actions, etc.)
  useEffect(() => {
    if (targetState === null || targetState === undefined) return;
    if (isManualDragRef.current) return; // Don't override manual drag
    
    const targetHeight = stateManager.targetHeight;
    setPanelHeight(targetHeight);
    setIsOpen(stateManager.shouldBeOpen);
  }, [targetState, setIsOpen, stateManager.targetHeight, stateManager.shouldBeOpen]);

  // Auto-open when zoomed in (optional - can be removed if not needed)
  // Disabled: Don't auto-open after user explicitly closes
  // useEffect(() => {
  //   if (currentZoom && currentZoom > 12 && !targetState) {
  //     // Auto-open to main state when zoomed in (only if no explicit targetState)
  //     if (panelHeight <= LOW_HEIGHT && currentState === 'low') {
  //       setPanelHeight(MAIN_HEIGHT);
  //       setIsOpen(true);
  //     }
  //   }
  // }, [currentZoom, panelHeight, setIsOpen, LOW_HEIGHT, MAIN_HEIGHT, targetState, currentState]);

  // Handle state transitions based on state manager (only if no explicit targetState)
  useEffect(() => {
    // Don't override explicit targetState
    if (targetState !== null && targetState !== undefined) return;
    
    // Sync panel height with state manager's target height
    const targetHeight = stateManager.targetHeight;
    if (Math.abs(panelHeight - targetHeight) > 5) {
      setPanelHeight(targetHeight);
      setIsOpen(stateManager.shouldBeOpen);
    }
  }, [stateManager.targetHeight, stateManager.shouldBeOpen, panelHeight, setIsOpen, targetState]);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange && currentState) {
      onStateChange(currentState);
    }
  }, [currentState, onStateChange]);


  // Fetch nearby pins only when search is active (not automatically on footer open)
  useEffect(() => {
    if (!isSearchActive || !mapCenter) {
      setNearbyPins([]);
      setLoadingNearby(false);
      return;
    }

    const fetchNearbyPins = async () => {
      setLoadingNearby(true);
      try {
        // 20 miles = 32.19 kilometers
        const radiusInKm = 20 * 1.60934; // Convert miles to kilometers
        
        const response = await fetch(
          `/api/mentions/nearby?lat=${mapCenter.lat}&lng=${mapCenter.lng}&radius=${radiusInKm}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setNearbyPins((data.mentions || []).slice(0, 20) as NearbyPin[]); // Limit to 20 nearby
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

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    isManualDragRef.current = true; // Mark as manual drag
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStartY(clientY);
    setDragStartHeight(panelHeight);
  }, [panelHeight]);

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragStartY - clientY; // Positive = dragging up
    const maxHeight = (isSearchActive || currentState === 'tall') ? TALL_HEIGHT : MAIN_HEIGHT;
    const newHeight = Math.max(TINY_HEIGHT, Math.min(maxHeight, dragStartHeight + deltaY));
    
    setPanelHeight(newHeight);
    
    // Update open state based on height
    if (newHeight <= TINY_HEIGHT + 20) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  }, [isDragging, dragStartY, dragStartHeight, setIsOpen, isSearchActive, currentState, TINY_HEIGHT, TALL_HEIGHT, MAIN_HEIGHT]);

  // Handle drag end - snap to nearest state
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    
    const currentHeight = panelHeight;
    const tinyThreshold = (TINY_HEIGHT + LOW_HEIGHT) / 2; // ~110px
    const lowThreshold = (LOW_HEIGHT + MAIN_HEIGHT) / 2; // Between low and main
    const mainThreshold = (MAIN_HEIGHT + TALL_HEIGHT) / 2; // Between main and tall
    
    // Snap to nearest state
    if (currentHeight <= tinyThreshold) {
      // Snap to tiny state (80px)
      setPanelHeight(TINY_HEIGHT);
      setIsOpen(false);
    } else if (currentHeight <= lowThreshold) {
      // Snap to low state (140px)
      setPanelHeight(LOW_HEIGHT);
      setIsOpen(false);
    } else if (currentState === 'tall' && currentHeight >= mainThreshold) {
      // Snap to tall state (90vh) - only for pin selection, not search
      setPanelHeight(TALL_HEIGHT);
      setIsOpen(true);
    } else {
      // Snap to main state (40vh) - used for search and other main content
      setPanelHeight(MAIN_HEIGHT);
      setIsOpen(true);
    }
    
    // Reset manual drag flag after a short delay
    setTimeout(() => {
      isManualDragRef.current = false;
    }, 100);
  }, [panelHeight, setIsOpen, TINY_HEIGHT, LOW_HEIGHT, MAIN_HEIGHT, TALL_HEIGHT, currentState]);

  // Set up drag listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchEnd = () => handleDragEnd();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Toggle open/closed - can be triggered by double-tap on drag handle or programmatically
  const togglePanel = useCallback(() => {
    if (hasContent) {
      if (isOpen) {
        setPanelHeight(LOW_HEIGHT);
        setIsOpen(false);
      } else {
        // Use main height for search, tall height for pin selection
        setPanelHeight(currentState === 'tall' ? TALL_HEIGHT : MAIN_HEIGHT);
        setIsOpen(true);
      }
    }
  }, [hasContent, isOpen, setIsOpen, currentState, LOW_HEIGHT, TALL_HEIGHT, MAIN_HEIGHT]);

  // Calculate actual height for rendering based on state
  const getActualHeight = (): number => {
    // Hidden state: slide down completely out of view
    if (currentState === 'hidden') {
      return HIDDEN_HEIGHT;
    }
    // Tiny state uses TINY_HEIGHT
    if (currentState === 'tiny') {
      return TINY_HEIGHT;
    }
    // Tall state (pin selection) uses TALL_HEIGHT
    if (currentState === 'tall' && isOpen) {
      return TALL_HEIGHT;
    }
    // Search active uses MAIN_HEIGHT
    if (isSearchActive && currentState === 'main' && isOpen) {
      return MAIN_HEIGHT;
    }
    if (panelHeight > LOW_HEIGHT) {
      return panelHeight;
    }
    return LOW_HEIGHT;
  };
  
  const actualHeight = getActualHeight();
  const isHidden = currentState === 'hidden';

  return (
    <footer
      ref={panelRef}
      className={`flex-shrink-0 flex flex-col border-t border-gray-200 bg-white rounded-tl-md rounded-tr-md overflow-hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out ${
        isHidden ? 'transform translate-y-full' : ''
      }`}
      style={{ 
        height: `${actualHeight}px`,
        maxHeight: '90vh', // Use viewport unit to avoid hydration mismatch
      }}
      data-container="app-footer"
      aria-label="App footer"
      aria-hidden={isHidden}
    >
      {/* Drag Handle Area - larger, more prominent, always visible */}
      <div
        ref={dragHandleRef}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className="flex-shrink-0 flex items-center justify-center h-4 py-2 cursor-grab active:cursor-grabbing touch-none bg-gray-50"
        aria-label="Drag to resize panel"
      >
        <div className="w-12 h-1 bg-gray-400 rounded-full" />
      </div>

      {/* Status Content - Accordion (e.g. LiveMapFooterStatus) - shown above header */}
      {statusContent && (
        <div className="flex-shrink-0 px-[10px] bg-gray-100 rounded-t-md">
          {statusContent}
        </div>
      )}

      {/* Header Content - Account dropdown, search, mention types - always visible */}
      <div className="flex-shrink-0 flex flex-col bg-white">
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

      {/* Content area (scrollable) - shows when panel is expanded beyond low/tiny state */}
      {currentState !== 'low' && currentState !== 'tiny' && currentState !== 'hidden' && (
        <div
          className="flex-1 overflow-y-auto min-h-0"
          data-container="app-footer-content"
        >
          {/* Tall state: 90vh overlay with search content or live pin card */}
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
                // Media (images/videos) shown edge-to-edge, other content wrapped in padding
                children
              )}
            </>
          ) : (
            <>
              {/* Main state: Search results, main action container, or pins */}
              {currentState === 'main' && (
                <>
                  {/* Search results card - shown when search is active */}
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
                    <>
                      {/* Main action container */}
                      {children && (
                        <div className="flex-shrink-0">
                          {children}
                        </div>
                      )}
                      
                      {/* Nearby pins section - hide when searching */}
                      {!isSearching && (
                        <NearbyPinsSection pins={nearbyPins} loading={loadingNearby} />
                      )}
                    </>
                  )}
                </>
              )}
              
              {/* Low state: no content shown, just header */}
            </>
          )}
        </div>
      )}

      {/* Spacer (always visible unless hidden or status content is present) */}
      {!hideSpacer && !statusContent && <div className="h-[25px] flex-shrink-0" aria-hidden />}
    </footer>
  );
}
