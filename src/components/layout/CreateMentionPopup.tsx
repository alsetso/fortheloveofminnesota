'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import CreateMentionContent from './CreateMentionContent';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface CreateMentionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  map?: MapboxMapInstance | null | undefined;
  mapLoaded: boolean;
  initialCoordinates?: { lat: number; lng: number } | null;
  initialAtlasMeta?: Record<string, any> | null;
  initialMapMeta?: Record<string, any> | null;
  onMentionCreated?: () => void;
}

/**
 * Slide-up popup for creating mentions
 * Appears from the bottom of the screen, positioned in front of mobile nav (z-[60])
 */
export default function CreateMentionPopup({
  isOpen,
  onClose,
  map,
  mapLoaded,
  initialCoordinates,
  initialAtlasMeta,
  initialMapMeta,
  onMentionCreated,
}: CreateMentionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isAtMaxHeight, setIsAtMaxHeight] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when popup is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (popupRef.current) {
          popupRef.current.style.transform = 'translateY(0)';
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
    if (!isOpen || !contentRef.current || !popupRef.current) return;

    const checkMaxHeight = () => {
      if (contentRef.current && popupRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const maxHeight = window.innerHeight * 0.8; // 80vh max
        
        setIsAtMaxHeight(contentHeight >= maxHeight || contentRef.current.scrollHeight > contentRef.current.clientHeight);
      }
    };

    checkMaxHeight();
    const timeoutId = setTimeout(checkMaxHeight, 100);

    const resizeObserver = new ResizeObserver(checkMaxHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [isOpen, initialCoordinates]);

  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.style.transform = 'translateY(100%)';
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!isOpen || !mounted) return null;

  const popupContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300"
        onClick={handleClose}
      />
      
      {/* Popup - positioned in front of mobile nav (z-[60], same as MapStylesPopup) */}
      <div
        ref={popupRef}
        className={`fixed bottom-0 left-0 right-0 z-[60] bg-white shadow-2xl transition-all duration-300 ease-out flex flex-col ${
          isAtMaxHeight ? 'rounded-none' : 'rounded-t-3xl'
        }`}
        style={{
          transform: 'translateY(100%)',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Create</h2>
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
            <h1 className="text-2xl font-semibold text-gray-900">Create</h1>
          </div>
        )}

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          {initialCoordinates ? (
            <CreateMentionContent
              map={map ?? null}
              mapLoaded={mapLoaded}
              initialCoordinates={initialCoordinates}
              initialAtlasMeta={initialAtlasMeta}
              initialMapMeta={initialMapMeta}
              onMentionCreated={onMentionCreated}
            />
          ) : (
            <div className="space-y-3 p-4">
              <p className="text-xs text-gray-600">
                Click on the map to select a location, then create a mention.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // Render to document body to escape parent stacking context
  return createPortal(popupContent, document.body);
}

