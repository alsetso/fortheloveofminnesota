'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface LayerRecordPopupProps {
  isOpen: boolean;
  onClose: () => void;
  record: {
    layerType: string;
    layerName: string;
    geometry: GeoJSON.Geometry;
    data: Record<string, any>;
    coordinates: { lat: number; lng: number };
    color: string;
  } | null;
  onAddMention?: (coordinates: { lat: number; lng: number }) => void;
}

/**
 * Popup that displays layer record data with a map showing the geometry
 */
export default function LayerRecordPopup({ isOpen, onClose, record, onAddMention }: LayerRecordPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        if (popupRef.current) {
          popupRef.current.style.transform = 'translateY(0)';
        }
      });
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';

  if (!mounted || !isOpen || !record) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 xl:hidden"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div
        ref={popupRef}
        className={`fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          bottom-0 left-0 right-0 rounded-t-3xl
          xl:bottom-0 xl:left-4 xl:right-auto xl:w-[500px] xl:rounded-t-lg xl:rounded-b-none xl:max-h-[50vh]
          ${useTransparentUI ? 'bg-transparent backdrop-blur-md' : 'bg-white'}`}
        style={{
          transform: 'translateY(100%)',
          minHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'auto' : '40vh',
          maxHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '50vh' : '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar - hidden on desktop */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0 xl:hidden">
          <div className={`w-12 h-1 rounded-full ${useTransparentUI ? 'bg-white/40' : 'bg-gray-300'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          useTransparentUI ? 'border-transparent' : 'border-gray-200'
        }`}>
          <h2 className={`text-sm font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
            {record.layerName}
          </h2>
          <button
            onClick={onClose}
            className={`p-1 -mr-1 transition-colors ${
              useWhiteText 
                ? 'text-gray-300 hover:text-white' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto xl:overflow-y-auto flex flex-col">
          <div className="p-3 space-y-3 flex-1">
            {/* Color Circle, Name, and Type */}
            <div className="flex items-center gap-3">
              {/* Color Circle */}
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: record.color }}
              />
              
              {/* Name and Type */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                  {record.layerName}
                </div>
                <div className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-600'}`}>
                  {record.layerType.charAt(0).toUpperCase() + record.layerType.slice(1)}
                </div>
              </div>
            </div>
            
            {/* 40px spacing */}
            <div className="h-10" />
          </div>
          
          {/* Sticky Add Mention Button */}
          {onAddMention && record.coordinates && (
            <div className={`sticky bottom-0 left-0 right-0 p-3 ${useTransparentUI ? 'bg-transparent backdrop-blur-md border-t border-white/20' : 'bg-white border-t border-gray-200'}`}>
              <button
                onClick={() => {
                  onAddMention(record.coordinates);
                }}
                className="w-full bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Add Mention
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

