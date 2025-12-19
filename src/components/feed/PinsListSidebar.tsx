'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicMapPinService } from '@/features/map-pins/services/publicMapPinService';
import type { MapPin } from '@/types/map-pin';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface PinsListSidebarProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  isOpen?: boolean;
}

export default function PinsListSidebar({ 
  map, 
  mapLoaded,
  isOpen = true,
}: PinsListSidebarProps) {
  const searchParams = useSearchParams();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pinsRef = useRef<MapPin[]>([]);

  // Fetch pins when map loads or year filter changes
  useEffect(() => {
    if (!mapLoaded) return;

    let mounted = true;

    const loadPins = async () => {
      setIsLoading(true);
      try {
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : undefined;
        
        const fetchedPins = await PublicMapPinService.getPins(year ? { year } : undefined);
        
        if (!mounted) return;
        
        pinsRef.current = fetchedPins;
        setPins(fetchedPins);
      } catch (error) {
        console.error('[PinsListSidebar] Error loading pins:', error);
        if (mounted) {
          setPins([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadPins();

    return () => {
      mounted = false;
    };
  }, [mapLoaded, searchParams]);

  // Listen for pin-created event to refresh list
  useEffect(() => {
    const handlePinCreatedEvent = async () => {
      try {
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : undefined;
        
        const fetchedPins = await PublicMapPinService.getPins(year ? { year } : undefined);
        pinsRef.current = fetchedPins;
        setPins(fetchedPins);
      } catch (error) {
        console.error('[PinsListSidebar] Error refreshing pins:', error);
      }
    };

    window.addEventListener('pin-created', handlePinCreatedEvent);
    return () => {
      window.removeEventListener('pin-created', handlePinCreatedEvent);
    };
  }, [searchParams]);

  // Handle pin click - fly to pin location on map
  const handlePinClick = (pin: MapPin) => {
    if (!map || !mapLoaded) return;
    
    map.flyTo({
      center: [pin.lng, pin.lat],
      zoom: 15,
      duration: 1500,
    });

    // Dispatch event to select pin (if needed by other components)
    window.dispatchEvent(new CustomEvent('select-pin', {
      detail: { pinId: pin.id }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 z-10 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-[10px] border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">All Pins</h2>
        {!isLoading && (
          <p className="text-xs text-gray-500 mt-0.5">{pins.length} pin{pins.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-[10px]">
            <div className="text-xs text-gray-500">Loading pins...</div>
          </div>
        ) : pins.length === 0 ? (
          <div className="p-[10px]">
            <div className="text-xs text-gray-500">No pins found</div>
          </div>
        ) : (
          <div className="space-y-0">
            {pins.map((pin) => (
              <button
                key={pin.id}
                onClick={() => handlePinClick(pin)}
                className="w-full text-left p-[10px] border-b border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="space-y-1.5">
                  {pin.description && (
                    <div className="text-xs text-gray-900 line-clamp-2">
                      {pin.description}
                    </div>
                  )}
                  {pin.account?.username && (
                    <div className="text-xs text-gray-500">
                      @{pin.account.username}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
