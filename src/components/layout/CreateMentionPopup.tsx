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
  initialMapMeta?: Record<string, any> | null;
  initialFullAddress?: string | null;
  initialImageBlob?: Blob | null;
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
  initialMapMeta,
  initialFullAddress,
  initialImageBlob,
  onMentionCreated,
}: CreateMentionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

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

  // Use transparent backgrounds and white text when satellite + blur
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';
  const useWhiteText = useTransparentUI;

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
          popupRef.current.style.transform = 'translate(-50%, 0)';
        }
      });
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);


  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.style.transform = 'translate(-50%, 100%)';
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mention-form-closed'));
      onClose();
    }, 300);
  };

  if (!isOpen || !mounted) return null;

  const popupContent = (
    <>
      {/* Backdrop - hidden on desktop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 xl:hidden"
        onClick={handleClose}
      />
      
      {/* Popup - positioned in front of mobile nav (z-[60], same as MapStylesPopup) */}
      <div
        ref={popupRef}
        className={`fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          /* Mobile: bottom sheet */
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-3xl
          /* Desktop: centered with max-width */
          xl:rounded-t-lg xl:rounded-b-none xl:max-h-[50vh]
          ${useTransparentUI
            ? 'bg-transparent backdrop-blur-md border-t border-white/20'
            : useBlurStyle
            ? 'bg-transparent backdrop-blur-md'
            : 'bg-white'
          }`}
        style={{
          transform: 'translate(-50%, 100%)',
          minHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'auto' : '40vh',
          maxHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '50vh' : '80vh',
          maxWidth: '600px',
          width: 'calc(100% - 2rem)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar - hidden on desktop */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0 xl:hidden">
          <div className={`w-12 h-1 rounded-full ${useBlurStyle ? 'bg-white/50' : 'bg-gray-300'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          useTransparentUI
            ? 'border-white/20'
            : useBlurStyle
            ? 'border-transparent'
            : 'border-gray-200'
        }`}>
          <h2 className={`text-sm font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>Create</h2>
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

        {/* Content - Always scrollable on desktop */}
        <div className="flex-1 overflow-y-auto xl:overflow-y-auto">
          {initialCoordinates ? (
            <CreateMentionContent
              map={map ?? null}
              mapLoaded={mapLoaded}
              initialCoordinates={initialCoordinates}
              initialMapMeta={initialMapMeta}
              initialFullAddress={initialFullAddress}
              initialImageBlob={initialImageBlob}
              onMentionCreated={onMentionCreated}
              useTransparentUI={useTransparentUI}
              useWhiteText={useWhiteText}
            />
          ) : (
            <div className="space-y-3 p-4">
              <p className={`text-xs ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>
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

