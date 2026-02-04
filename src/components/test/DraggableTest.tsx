'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import AppHeader from '@/components/layout/AppHeader';
import SearchContent from '@/components/layout/SearchContent';
import { MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useSearchState } from '@/contexts/SearchStateContext';
import { useToast } from '@/features/ui/hooks/useToast';

/**
 * Test draggable component - constrained horizontally, draggable vertically with snap-to sections
 * 
 * Features:
 * - 200px tall container
 * - Matches max-width container width (500px, centered)
 * - Can only be dragged up and down (vertical movement only)
 * - Snaps to 6 vertical sections when released
 * - Section 1: Handle at top of screen
 * - Sections 2-5: Evenly spaced in between
 * - Section 6: Handle at bottom, content extends below screen
 * - Handle stays within viewport bounds, content can extend outside
 */
interface DraggableTestProps {
  /** Map instance for AppHeader */
  map?: any;
  /** Callback when a location is selected */
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string) => void;
}

type MentionType = { id: string; emoji: string; name: string };

export default function DraggableTest({ map, onLocationSelect }: DraggableTestProps = {}) {
  const CONTAINER_WIDTH = 500; // Matches AppContentWidth max-width
  const HEADER_HEIGHT = 60; // Approximate height of AppHeader (account + search)
  const supabase = useSupabaseClient();
  const { isSearchActive, isSearching } = useSearchState();
  const { success, info } = useToast();
  
  // Track height from bottom (distance from bottom of screen)
  const [heightFromBottom, setHeightFromBottom] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loadingMentionTypes, setLoadingMentionTypes] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch mention types
  useEffect(() => {
    const fetchMentionTypes = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setMentionTypes((data || []) as MentionType[]);
      } catch (err) {
        console.error('Failed to fetch mention types:', err);
        setMentionTypes([]);
      } finally {
        setLoadingMentionTypes(false);
      }
    };

    fetchMentionTypes();
  }, [supabase]);

  // Calculate left position to center the container (matching AppContentWidth)
  const leftPosition = typeof window !== 'undefined' 
    ? (window.innerWidth - CONTAINER_WIDTH) / 2 
    : 0;

  // Calculate 6 snap positions (sections) as heights from bottom
  // Section 1: Small height (header only visible)
  // Sections 2-5: Evenly spaced heights
  // Section 6: Full height (header at top of screen)
  const getSnapPositions = useCallback(() => {
    if (typeof window === 'undefined') return [HEADER_HEIGHT, 0, 0, 0, 0, 0];
    
    const viewportHeight = window.innerHeight;
    
    // 6 sections total - heights from bottom:
    // Section 1: Just header visible (HEADER_HEIGHT)
    // Sections 2-5: Divide remaining space into 5 parts
    // Section 6: Full viewport height
    const availableHeight = viewportHeight - HEADER_HEIGHT;
    const sectionHeight = availableHeight / 5;
    
    return [
      HEADER_HEIGHT,                        // Section 1: Just header visible
      HEADER_HEIGHT + sectionHeight,        // Section 2: ~20% of viewport
      HEADER_HEIGHT + sectionHeight * 2,   // Section 3: ~40% of viewport
      HEADER_HEIGHT + sectionHeight * 3,   // Section 4: ~60% of viewport
      HEADER_HEIGHT + sectionHeight * 4,   // Section 5: ~80% of viewport
      viewportHeight,                       // Section 6: Full height
    ];
  }, [HEADER_HEIGHT]);

  // Find the closest snap position to the current height from bottom
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

  // Handle drag start - capture initial mouse/touch Y position
  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    
    // Get initial mouse/touch Y position
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Store the initial Y position and current height
    setDragStartY(clientY);
    setDragStartHeight(heightFromBottom);
    
    // Prevent default to avoid text selection or other browser behaviors
    e.preventDefault();
  }, [heightFromBottom]);

  // Handle drag move - update height from bottom based on drag distance
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || isAnimating) return;
    
    // Get current mouse/touch Y position
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Calculate delta: dragging up (decreasing Y) increases height from bottom
    const deltaY = dragStartY - clientY; // Positive = dragging up
    
    // Calculate new height from bottom
    const newHeight = dragStartHeight + deltaY;
    
    // Constrain: minimum is header height, maximum is viewport height
    const minHeight = HEADER_HEIGHT;
    const maxHeight = typeof window !== 'undefined' ? window.innerHeight : HEADER_HEIGHT;
    
    setHeightFromBottom(Math.max(minHeight, Math.min(maxHeight, newHeight)));
  }, [isDragging, dragStartY, dragStartHeight, isAnimating, HEADER_HEIGHT]);

  // Handle drag end - snap to nearest section
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    
    // Find closest snap position (height from bottom)
    const targetHeight = findClosestSnapPosition(heightFromBottom);
    
    // If already close to snap position, don't animate
    if (Math.abs(heightFromBottom - targetHeight) < 5) {
      return;
    }
    
    // Animate to closest snap position
    setIsAnimating(true);
    
    const startHeight = heightFromBottom;
    const distance = targetHeight - startHeight;
    const duration = 300; // Animation duration in ms
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentHeight = startHeight + (distance * easeOut);
      setHeightFromBottom(currentHeight);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        setHeightFromBottom(targetHeight); // Ensure exact final position
      }
    };
    
    requestAnimationFrame(animate);
  }, [heightFromBottom, findClosestSnapPosition]);

  // Set up document-level event listeners when dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchEnd = () => handleDragEnd();

    // Add listeners to document so dragging works even if cursor leaves the element
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

  const snapPositions = getSnapPositions();

  return (
    <>
      {/* Visual indicators for snap positions */}
      {typeof window !== 'undefined' && (
        <div className="fixed left-0 right-0 top-0 bottom-0 z-[2999] pointer-events-none">
          {snapPositions.map((snapHeight, index) => {
            const topPosition = typeof window !== 'undefined' 
              ? window.innerHeight - snapHeight 
              : 0;
            return (
              <div
                key={index}
                className="absolute left-1/2 -translate-x-1/2 w-[520px] h-0.5 bg-blue-300 opacity-30"
                style={{
                  top: `${topPosition}px`,
                  transition: 'opacity 0.2s',
                }}
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] text-blue-500 font-medium">
                  Section {index + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <div
        ref={containerRef}
        className={`fixed z-[3000] select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-move'
        } ${isAnimating ? 'transition-none' : ''}`}
        style={{
          left: `${leftPosition}px`,
          bottom: 0,
          width: `${CONTAINER_WIDTH}px`,
          height: `${heightFromBottom}px`,
          maxWidth: `${CONTAINER_WIDTH}px`,
          maxHeight: typeof window !== 'undefined' ? `${window.innerHeight}px` : '100vh',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          borderBottomLeftRadius: '0px',
          borderBottomRightRadius: '0px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)', // 90% opacity (10% reduction)
          backdropFilter: 'blur(2px)', // 2% blur
          WebkitBackdropFilter: 'blur(2px)', // Safari support
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)', // Line drop shadow at top
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
      {/* Drag handle area - contains AppHeader (account + search) */}
      <div
        className="w-full flex-shrink-0 cursor-grab active:cursor-grabbing"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.9)', // 90% opacity
          backdropFilter: 'blur(2px)', // 2% blur
          WebkitBackdropFilter: 'blur(2px)', // Safari support
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="px-[10px]">
          <AppHeader 
            map={map}
            onLocationSelect={onLocationSelect}
            currentFooterState="main"
          />
        </div>
      </div>
      
      {/* Content area - dynamically sized */}
      <div 
        ref={contentRef}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col scrollbar-hide"
        style={{
          maxHeight: heightFromBottom > HEADER_HEIGHT 
            ? `${heightFromBottom - HEADER_HEIGHT}px` 
            : 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)', // 90% opacity
          backdropFilter: 'blur(2px)', // 2% blur
          WebkitBackdropFilter: 'blur(2px)', // Safari support
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
        }}
      >
        {/* Show search results when searching */}
        {isSearchActive ? (
          <SearchContent
            onCityClick={(coords) => {
              success('City clicked', `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`);
              if (onLocationSelect) {
                onLocationSelect(coords, '');
              }
              window.dispatchEvent(
                new CustomEvent('live-search-pin-select', {
                  detail: coords,
                })
              );
            }}
          />
        ) : (
          <>
            {/* Mention Types Carousel - hide when searching */}
            {!isSearching && (
              <div className="flex-shrink-0 px-[10px] py-3">
                <h3 className="text-xs font-semibold text-gray-900 mb-2">Mention Types</h3>
                {loadingMentionTypes ? (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-md animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {mentionTypes.map((type) => (
                      <div
                        key={type.id}
                        className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-md flex flex-col items-center justify-center border border-gray-200"
                      >
                        <span className="text-2xl mb-1">{type.emoji}</span>
                        <span className="text-[10px] text-gray-600 text-center px-1 truncate w-full">
                          {type.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search History - hide when searching */}
            {!isSearching && (
              <div className="flex-shrink-0 px-[10px] py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <ClockIcon className="w-3 h-3 text-gray-500" />
                  <h3 className="text-xs font-semibold text-gray-900">Recent Searches</h3>
                </div>
                <div className="space-y-1">
                  {[
                    'Minneapolis, MN',
                    'St. Paul, MN',
                    'Duluth, MN',
                    'Rochester, MN',
                    'Bloomington, MN',
                  ].map((search, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded transition-colors"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fake Pins List - hide when searching */}
            {!isSearching && (
              <div className="flex-1 px-[10px] py-3">
                <h3 className="text-xs font-semibold text-gray-900 mb-2">Nearby Pins</h3>
                <div className="space-y-2">
                  {[
                    { id: 1, title: 'Lake Superior View', username: 'johndoe', time: '2h ago', emoji: '🏔️' },
                    { id: 2, title: 'Downtown Minneapolis', username: 'janedoe', time: '5h ago', emoji: '🏙️' },
                    { id: 3, title: 'Mississippi River', username: 'minnesota_lover', time: '1d ago', emoji: '🌊' },
                    { id: 4, title: 'State Capitol', username: 'stpaul_local', time: '2d ago', emoji: '🏛️' },
                    { id: 5, title: 'Mall of America', username: 'shopper123', time: '3d ago', emoji: '🛍️' },
                    { id: 6, title: 'Boundary Waters', username: 'nature_seeker', time: '4d ago', emoji: '🌲' },
                    { id: 7, title: 'Minnehaha Falls', username: 'waterfall_fan', time: '5d ago', emoji: '💧' },
                    { id: 8, title: 'Guthrie Theater', username: 'arts_lover', time: '1w ago', emoji: '🎭' },
                  ].map((pin) => (
                    <button
                      key={pin.id}
                      type="button"
                      className="w-full flex items-start gap-2 p-[10px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
                        <span className="text-lg">{pin.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {pin.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          @{pin.username} · {pin.time}
                        </p>
                      </div>
                      <MapPinIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}
