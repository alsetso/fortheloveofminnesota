'use client';

import { useEffect, useRef } from 'react';
import { XMarkIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';

interface MapEntityPopupProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'pin' | 'atlas' | 'location' | null;
  data: {
    // Pin/Mention data
    id?: string;
    description?: string;
    account?: {
      username?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      image_url?: string | null;
    } | null;
    created_at?: string;
    // Atlas entity data
    name?: string;
    table_name?: string;
    icon_path?: string | null;
    // Location data
    place_name?: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  } | null;
}

/**
 * iOS-style popup that appears above mobile nav (z-[60])
 * Shows pin, atlas entity, or location details
 */
export default function MapEntityPopup({ isOpen, onClose, type, data }: MapEntityPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

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
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.style.transform = 'translateY(100%)';
    }
    // Wait for animation to complete
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!isOpen || !data) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Popup - Covers mobile nav */}
      <div
        ref={popupRef}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out flex flex-col"
        style={{
          transform: 'translateY(100%)',
          maxHeight: '100vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">
            {type === 'pin' ? 'Mention' : type === 'atlas' ? data.name || 'Location' : 'Location'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 -mr-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Pin/Mention Content */}
            {type === 'pin' && (
              <>
                {data.account && (
                  <div className="flex items-center gap-2">
                    {data.account.image_url ? (
                      <Image
                        src={data.account.image_url}
                        alt={data.account.username || 'User'}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                        unoptimized={data.account.image_url.startsWith('data:') || data.account.image_url.includes('supabase.co')}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {data.account.username?.[0]?.toUpperCase() || data.account.first_name?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-medium text-gray-900">
                        {data.account.username || `${data.account.first_name || ''} ${data.account.last_name || ''}`.trim() || 'User'}
                      </div>
                    </div>
                  </div>
                )}
                {data.description && (
                  <div className="text-xs text-gray-700">
                    {data.description}
                  </div>
                )}
                {data.created_at && (
                  <div className="text-xs text-gray-500">
                    {formatDate(data.created_at)}
                  </div>
                )}
              </>
            )}

            {/* Atlas Entity Content */}
            {type === 'atlas' && (
              <>
                <div className="flex items-center gap-2">
                  {data.icon_path && (
                    <Image
                      src={data.icon_path}
                      alt={data.name || 'Entity'}
                      width={24}
                      height={24}
                      className="w-6 h-6 object-contain"
                      unoptimized
                    />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-gray-900">
                      {data.name}
                    </div>
                    {data.table_name && (
                      <div className="text-xs text-gray-500 capitalize">
                        {data.table_name.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Location Content */}
            {type === 'location' && (
              <>
                <div className="flex items-start gap-2">
                  <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {data.place_name && (
                      <div className="text-xs font-medium text-gray-900">
                        {data.place_name}
                      </div>
                    )}
                    {data.address && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {data.address}
                      </div>
                    )}
                    {data.coordinates && (
                      <div className="text-xs text-gray-400 mt-1">
                        {data.coordinates.lat.toFixed(6)}, {data.coordinates.lng.toFixed(6)}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Save/Add Label Button */}
                {data.coordinates && (
                  <>
                    {MinnesotaBoundsService.isWithinMinnesota(data.coordinates) ? (
                      <button
                        onClick={() => {
                          // Dispatch event to show location for mention creation
                          window.dispatchEvent(new CustomEvent('show-location-for-mention', {
                            detail: { 
                              lat: data.coordinates!.lat, 
                              lng: data.coordinates!.lng 
                            }
                          }));
                          handleClose();
                        }}
                        className="w-full mt-4 px-4 py-2.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors flex items-center justify-center gap-2"
                      >
                        <span>Add Label</span>
                      </button>
                    ) : (
                      <div className="w-full mt-4 px-4 py-2.5 text-xs text-gray-600 bg-gray-100 rounded-md text-center">
                        Location outside Minnesota
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

