'use client';

import { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import SheetSearchInput from './SheetSearchInput';

interface MobileNavSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showSearch?: boolean;
  map?: any;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string) => void;
}

/**
 * iOS-style slide-up sheet that appears behind the mobile nav (z-[50])
 * but in front of the map top container (z-[45]). Uses smooth spring-like animations.
 */
export default function MobileNavSheet({ isOpen, onClose, title, children, showSearch = false, map, onLocationSelect }: MobileNavSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAtMaxHeight, setIsAtMaxHeight] = useState(false);

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
        const containerHeight = sheetRef.current.clientHeight;
        const maxHeight = window.innerHeight - 64; // 4rem = 64px for mobile nav
        
        // Check if content is scrollable (reached max height)
        setIsAtMaxHeight(contentHeight >= maxHeight || contentRef.current.scrollHeight > contentRef.current.clientHeight);
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
      {/* Sheet - behind nav, in front of map top container */}
      <div
        ref={sheetRef}
        className={`fixed bottom-16 left-0 right-0 z-[46] bg-white shadow-2xl transition-all duration-300 ease-out flex flex-col ${
          isAtMaxHeight ? 'rounded-none' : 'rounded-t-3xl'
        }`}
        style={{
          transform: 'translateY(100%)',
          maxHeight: 'calc(100vh - 4rem)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            onClick={handleClose}
            className="p-1 -mr-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Large Headline - Shows when at max height */}
        {isAtMaxHeight && (
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 transition-opacity duration-300" style={{ opacity: isAtMaxHeight ? 1 : 0 }}>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          </div>
        )}

        {/* Search Input - Shows when at max height and showSearch is true */}
        {isAtMaxHeight && showSearch && (
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 transition-opacity duration-300" style={{ opacity: isAtMaxHeight ? 1 : 0 }}>
            <SheetSearchInput map={map} onLocationSelect={onLocationSelect} />
          </div>
        )}

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
