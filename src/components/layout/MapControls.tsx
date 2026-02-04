'use client';

import { ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import AppHeader from './AppHeader';
import HeaderMentionTypeCards from './HeaderMentionTypeCards';
import { useSearchState } from '@/contexts/SearchStateContext';
import type { MapInstance, NearbyPin } from './types';

interface MapControlsProps {
  /** Dynamic content (LivePinCard, MapInfo, MentionTypeInfoCard, etc.) */
  children?: ReactNode;
  /** Status content (e.g. LiveMapFooterStatus) - shown above header */
  statusContent?: ReactNode;
  /** When set, account image in header opens this (e.g. AppMenu) instead of account dropdown */
  onAccountImageClick?: () => void;
  /** Universal close handler - clears selections */
  onUniversalClose?: () => void;
  /** Whether close icon should be shown (auto-shown when children exist) */
  showCloseIcon?: boolean;
  /** Map instance for AppHeader */
  map?: MapInstance;
  /** Callback when a location is selected */
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string) => void;
  /** Whether to show mention types */
  showMentionTypes?: boolean;
}

const CONTAINER_WIDTH = 500;
const HEADER_HEIGHT = 60;

// Calculate responsive container width
const getContainerWidth = (): number => {
  if (typeof window === 'undefined') return CONTAINER_WIDTH;
  const viewportWidth = window.innerWidth;
  // Full width on mobile (< 640px), max 500px on larger screens
  return Math.min(viewportWidth - 16, CONTAINER_WIDTH); // 16px for padding on mobile
};

/**
 * MapControls - Draggable slide-up panel for map controls
 * 
 * Structure:
 * 1. Status Content (optional)
 * 2. AppHeader (always visible, draggable)
 * 3. HeaderMentionTypeCards (when showMentionTypes && !isSearching)
 * 4. Content Area: Shows children (LivePinCard, MapInfo, etc.) when provided
 */
export default function MapControls({
  children,
  statusContent,
  onAccountImageClick,
  onUniversalClose,
  showCloseIcon = false,
  map,
  onLocationSelect,
  showMentionTypes = false,
}: MapControlsProps) {
  const { isSearching } = useSearchState();
  
  // Calculate "low" position (second snap position)
  const getLowHeight = useCallback(() => {
    if (typeof window === 'undefined') return 140;
    const viewportHeight = window.innerHeight;
    const availableHeight = viewportHeight - HEADER_HEIGHT;
    const sectionHeight = availableHeight / 4;
    return HEADER_HEIGHT + sectionHeight; // Second snap position (low)
  }, []);
  
  // Drag state - initialize to "low" position
  const [heightFromBottom, setHeightFromBottom] = useState(140); // Temporary, will update on mount
  
  // Set initial height to "low" on mount
  useEffect(() => {
    setHeightFromBottom(getLowHeight());
  }, [getLowHeight]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(CONTAINER_WIDTH);
  const [leftPosition, setLeftPosition] = useState(0);

  // Calculate responsive container width and left position
  useEffect(() => {
    const updateDimensions = () => {
      if (typeof window !== 'undefined') {
        const width = getContainerWidth();
        setContainerWidth(width);
        // Center on larger screens, full width on mobile
        const viewportWidth = window.innerWidth;
        if (viewportWidth >= 640) {
          setLeftPosition((viewportWidth - width) / 2);
        } else {
          setLeftPosition(8); // 8px padding on mobile
        }
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Calculate snap positions
  const getSnapPositions = useCallback(() => {
    if (typeof window === 'undefined') return [60, 140, 220, 300, 380];
    
    const viewportHeight = window.innerHeight;
    const availableHeight = viewportHeight - HEADER_HEIGHT;
    const sectionHeight = availableHeight / 4;
    
    return [
      HEADER_HEIGHT,
      HEADER_HEIGHT + sectionHeight,
      HEADER_HEIGHT + sectionHeight * 2,
      HEADER_HEIGHT + sectionHeight * 3,
      HEADER_HEIGHT + sectionHeight * 4,
    ];
  }, []);

  // Find closest snap position
  const findClosestSnapPosition = useCallback((currentHeight: number) => {
    const snapPositions = getSnapPositions();
    let closest = snapPositions[0];
    let minDistance = Math.abs(currentHeight - closest);
    
    for (const snapPos of snapPositions) {
      const distance = Math.abs(currentHeight - snapPos);
      if (distance < minDistance) {
        minDistance = distance;
        closest = snapPos;
      }
    }
    
    return closest;
  }, [getSnapPositions]);

  // Handle close - animate to position 1 (handle only - HEADER_HEIGHT) then call onUniversalClose
  const handleClose = useCallback(() => {
    const handleOnlyHeight = HEADER_HEIGHT; // First snap position (handle only)
    
    setIsAnimating(true);
    const startHeight = heightFromBottom;
    const distance = handleOnlyHeight - startHeight;
    const duration = 300;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentHeight = startHeight + (distance * easeOut);
      setHeightFromBottom(currentHeight);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        setHeightFromBottom(handleOnlyHeight);
        // Call onUniversalClose after animation completes
        onUniversalClose?.();
      }
    };
    
    requestAnimationFrame(animate);
  }, [heightFromBottom, onUniversalClose]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStartY(clientY);
    setDragStartHeight(heightFromBottom);
    e.preventDefault();
  }, [heightFromBottom]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || isAnimating) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragStartY - clientY;
    const newHeight = dragStartHeight + deltaY;
    
    const minHeight = HEADER_HEIGHT;
    const maxHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    
    setHeightFromBottom(Math.max(minHeight, Math.min(maxHeight, newHeight)));
  }, [isDragging, dragStartY, dragStartHeight, isAnimating]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    
    const snapPositions = getSnapPositions();
    const targetHeight = findClosestSnapPosition(heightFromBottom);
    const isFirstSection = targetHeight === snapPositions[0];
    
    if (Math.abs(heightFromBottom - targetHeight) < 5) {
      if (isFirstSection) {
        onUniversalClose?.();
      }
      return;
    }
    
    setIsAnimating(true);
    
    const startHeight = heightFromBottom;
    const distance = targetHeight - startHeight;
    const duration = 300;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentHeight = startHeight + (distance * easeOut);
      setHeightFromBottom(currentHeight);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        setHeightFromBottom(targetHeight);
        
        if (isFirstSection) {
          onUniversalClose?.();
        }
      }
    };
    
    requestAnimationFrame(animate);
  }, [heightFromBottom, findClosestSnapPosition, getSnapPositions, onUniversalClose]);

  // Set up document-level event listeners when dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchEnd = () => handleDragEnd();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Calculate actual header height (includes mention types if visible and no children)
  const actualHeaderHeight = showMentionTypes && !children ? HEADER_HEIGHT + 60 : HEADER_HEIGHT;
  
  // Determine if content should be visible
  const shouldShowContent = heightFromBottom > actualHeaderHeight + 20;

  return (
    <div
      ref={containerRef}
      className={`fixed z-[3000] select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-move'
      } ${isAnimating ? 'transition-none' : ''}`}
      style={{
        left: `${leftPosition}px`,
        bottom: 0,
        width: `${containerWidth}px`,
        height: `${heightFromBottom}px`,
        maxWidth: `${CONTAINER_WIDTH}px`,
        maxHeight: '100vh',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        borderBottomLeftRadius: '0px',
        borderBottomRightRadius: '0px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        borderLeft: '1px solid rgba(0, 0, 0, 0.1)',
        borderRight: '1px solid rgba(0, 0, 0, 0.1)',
        userSelect: 'none',
        transition: isAnimating ? 'none' : undefined,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 1. Status Content (optional) */}
      {statusContent && (
        <div 
          className="flex-shrink-0 px-[10px] rounded-t-md"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        >
          {statusContent}
        </div>
      )}

      {/* 2. AppHeader (always visible, draggable) */}
      <div
        className="w-full flex-shrink-0 cursor-grab active:cursor-grabbing"
        data-draggable-container="true"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="px-[10px]">
          <AppHeader 
            onAccountImageClick={onAccountImageClick}
            onUniversalClose={handleClose}
            showCloseIcon={false}
            currentFooterState="main"
            map={map}
            onLocationSelect={onLocationSelect}
          />
        </div>
      </div>
      
      {/* 3. HeaderMentionTypeCards (when showMentionTypes and no children) */}
      {showMentionTypes && shouldShowContent && !children && (
        <div 
          className="flex-shrink-0 px-[10px]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        >
          <HeaderMentionTypeCards />
        </div>
      )}
      
      {/* 4. Content Area - Shows children when provided */}
      {shouldShowContent && children && (
        <div 
          ref={contentRef}
          className="flex-1 min-h-0 overflow-y-auto flex flex-col scrollbar-hide"
          style={{
            maxHeight: heightFromBottom > actualHeaderHeight 
              ? `${heightFromBottom - actualHeaderHeight}px` 
              : 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div 
            className="flex-1 min-h-0"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
