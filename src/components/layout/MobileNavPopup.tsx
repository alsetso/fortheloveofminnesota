'use client';

import { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import SheetSearchInput from './SheetSearchInput';

interface MobileNavPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showSearch?: boolean;
  map?: any;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string) => void;
  headerAction?: React.ReactNode;
  contentPadding?: boolean;
}

/**
 * Dynamic mobile nav popup that automatically adapts colors based on:
 * - Map style (streets vs satellite)
 * - Blur style (transparent vs solid)
 * 
 * Color logic:
 * - Solid white background: Dark text
 * - Transparent blur + streets: Dark text
 * - Transparent blur + satellite: White text
 * 
 * iOS-style slide-up sheet that appears behind the mobile nav (z-[50])
 * but in front of the map top container (z-[45]).
 */
export default function MobileNavPopup({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  showSearch = false, 
  map, 
  onLocationSelect, 
  headerAction, 
  contentPadding = true 
}: MobileNavPopupProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAtMaxHeight, setIsAtMaxHeight] = useState(false);
  
  // State for blur and map style
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Dynamic color logic: White text only when transparent blur + satellite
  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  // Handle sheet open/close animations
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transform = 'translateY(0)';
        }
      });
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
      setIsAtMaxHeight(false);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Check if content reaches max height
  useEffect(() => {
    if (!isOpen || !contentRef.current || !sheetRef.current) return;

    const checkMaxHeight = () => {
      if (contentRef.current && sheetRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const maxHeight = window.innerHeight;
        
        // Check if content is scrollable (reached max height)
        setIsAtMaxHeight(
          contentHeight >= maxHeight || 
          contentRef.current.scrollHeight > contentRef.current.clientHeight
        );
      }
    };

    // Check immediately and after a short delay for content to render
    checkMaxHeight();
    const timeoutId = setTimeout(checkMaxHeight, 100);

    // Use ResizeObserver to watch for content changes
    const resizeObserver = new ResizeObserver(checkMaxHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [isOpen, children]);

  const handleClose = () => {
    if (sheetRef.current) {
      sheetRef.current.style.transform = 'translateY(100%)';
    }
    // Wait for animation to complete
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Sheet - positioned at bottom on mobile and desktop */}
      <div
        ref={sheetRef}
        className={`fixed z-[46] shadow-2xl transition-all duration-300 ease-out flex flex-col
          /* Mobile: bottom sheet */
          bottom-0 left-0 right-0
          ${isAtMaxHeight ? 'rounded-none' : 'rounded-t-3xl'}
          /* Desktop: bottom sheet with 500px width, left side, squared bottom corners */
          xl:bottom-0 xl:left-4 xl:w-[500px] xl:rounded-t-lg xl:rounded-b-none xl:max-h-[50vh]
          ${useBlurStyle ? 'bg-transparent backdrop-blur-md' : 'bg-white'}`}
        style={{
          transform: 'translateY(100%)',
          maxHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '50vh' : '100vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar - hidden on desktop */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0 xl:hidden">
          <div className={`w-12 h-1 rounded-full ${
            useBlurStyle 
              ? (useWhiteText ? 'bg-white/40' : 'bg-gray-400') 
              : 'bg-gray-300'
          }`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          useBlurStyle 
            ? (useWhiteText ? 'border-white/20' : 'border-gray-300') 
            : 'border-gray-200'
        }`}>
          <h2 className={`text-sm font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              onClick={handleClose}
              className={`p-1 -mr-1 transition-colors ${
                useWhiteText
                  ? 'text-white/80 hover:text-white' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Large Headline - Shows when at max height */}
        {isAtMaxHeight && (
          <div className={`px-4 py-3 border-b flex-shrink-0 transition-opacity duration-300 ${
            useBlurStyle 
              ? (useWhiteText ? 'border-white/20' : 'border-gray-300') 
              : 'border-gray-200'
          }`} style={{ opacity: isAtMaxHeight ? 1 : 0 }}>
            <h1 className={`text-2xl font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h1>
          </div>
        )}

        {/* Search Input - Shows when at max height and showSearch is true */}
        {isAtMaxHeight && showSearch && (
          <div className={`px-4 py-3 border-b flex-shrink-0 transition-opacity duration-300 ${
            useBlurStyle ? 'border-transparent' : 'border-gray-200'
          }`} style={{ opacity: isAtMaxHeight ? 1 : 0 }}>
            <SheetSearchInput map={map} onLocationSelect={onLocationSelect} />
          </div>
        )}

        {/* Content - Always scrollable on desktop */}
        <div ref={contentRef} className="flex-1 overflow-y-auto xl:overflow-y-auto">
          <div className={contentPadding ? 'p-4' : ''}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

