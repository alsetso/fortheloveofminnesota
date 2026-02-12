'use client';

import { ReactNode, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
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
  /** When provided, position relative to this element (absolute); otherwise viewport-fixed */
  anchorRef?: React.RefObject<HTMLElement | null>;
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
  anchorRef,
}: MapControlsProps) {
  const { isSearching } = useSearchState();

  // Effective height for snap calculations (anchor height when anchored, else viewport)
  const getEffectiveHeight = useCallback(() => {
    if (anchorRef?.current) {
      return anchorRef.current.getBoundingClientRect().height;
    }
    return typeof window !== 'undefined' ? window.innerHeight : 800;
  }, [anchorRef]);

  // Calculate "low" position (second snap position)
  const getLowHeight = useCallback(() => {
    const effectiveHeight = getEffectiveHeight();
    const availableHeight = effectiveHeight - HEADER_HEIGHT;
    const sectionHeight = availableHeight / 4;
    return HEADER_HEIGHT + sectionHeight;
  }, [getEffectiveHeight]);
  
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate responsive container width and left position (viewport or anchor)
  useLayoutEffect(() => {
    const updateDimensions = () => {
      if (typeof window === 'undefined') return;
      const anchor = anchorRef?.current;
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        const anchorWidth = rect.width;
        const width = Math.min(anchorWidth - 16, CONTAINER_WIDTH);
        setContainerWidth(width);
        setLeftPosition((anchorWidth - width) / 2);
      } else {
        const width = getContainerWidth();
        setContainerWidth(width);
        const viewportWidth = window.innerWidth;
        if (viewportWidth >= 640) {
          setLeftPosition((viewportWidth - width) / 2);
        } else {
          setLeftPosition(8);
        }
      }
    };

    updateDimensions();
    const anchor = anchorRef?.current;
    if (anchor) {
      const ro = new ResizeObserver(updateDimensions);
      ro.observe(anchor);
      window.addEventListener('resize', updateDimensions);
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', updateDimensions);
      };
    }
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [anchorRef]);

  // Calculate snap positions
  const getSnapPositions = useCallback(() => {
    const effectiveHeight = getEffectiveHeight();
    const availableHeight = effectiveHeight - HEADER_HEIGHT;
    const sectionHeight = availableHeight / 4;
    
    return [
      HEADER_HEIGHT,
      HEADER_HEIGHT + sectionHeight,
      HEADER_HEIGHT + sectionHeight * 2,
      HEADER_HEIGHT + sectionHeight * 3,
      HEADER_HEIGHT + sectionHeight * 4,
    ];
  }, [getEffectiveHeight]);

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
    const maxHeight = getEffectiveHeight();
    
    setHeightFromBottom(Math.max(minHeight, Math.min(maxHeight, newHeight)));
  }, [isDragging, dragStartY, dragStartHeight, isAnimating, getEffectiveHeight]);

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

  const positionClass = anchorRef ? 'absolute' : 'fixed';

  return (
    <div
      ref={containerRef}
      className={`${positionClass} z-[3000] select-none rounded-t-lg flex flex-col overflow-hidden
        bg-[hsl(var(--header)/0.95)] backdrop-blur-sm
        border-t border-l border-r border-border-muted
        shadow-[0_-2px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_12px_rgba(0,0,0,0.35)]
        ${isDragging ? 'cursor-grabbing' : 'cursor-move'}
        ${isAnimating ? 'transition-none' : ''}`}
      style={{
        left: mounted ? `${leftPosition}px` : '0px',
        bottom: 0,
        width: mounted ? `${containerWidth}px` : `${CONTAINER_WIDTH}px`,
        height: `${heightFromBottom}px`,
        maxWidth: `${CONTAINER_WIDTH}px`,
        maxHeight: mounted ? (anchorRef ? `${getEffectiveHeight()}px` : '100vh') : '800px',
        userSelect: 'none',
        ...(mounted && isAnimating && { transition: 'none' }),
      }}
    >
      {/* 1. Status Content (optional) */}
      {statusContent && (
        <div className="flex-shrink-0 px-[10px] rounded-t-md bg-[hsl(var(--header)/0.95)] backdrop-blur-sm">
          {statusContent}
        </div>
      )}

      {/* 2. AppHeader (always visible, draggable) */}
      <div
        className="w-full flex-shrink-0 cursor-grab active:cursor-grabbing bg-[hsl(var(--header)/0.95)] backdrop-blur-sm"
        data-draggable-container="true"
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
        <div className="flex-shrink-0 px-[10px] bg-[hsl(var(--header)/0.95)] backdrop-blur-sm">
          <HeaderMentionTypeCards />
        </div>
      )}
      
      {/* 4. Content Area - Shows children when provided */}
      {shouldShowContent && children && (
        <div
          ref={contentRef}
          className="flex-1 min-h-0 overflow-y-auto flex flex-col scrollbar-hide bg-[hsl(var(--header)/0.95)] backdrop-blur-sm"
          style={{
            maxHeight: heightFromBottom > actualHeaderHeight
              ? `${heightFromBottom - actualHeaderHeight}px`
              : 0,
          }}
        >
          <div className="flex-1 min-h-0 px-[10px] bg-[hsl(var(--header)/0.95)] backdrop-blur-sm">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
