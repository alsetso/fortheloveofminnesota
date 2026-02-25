'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DynamicMapContainer from './DynamicMapContainer';
import LiveMapLeftSidebar from './LiveMapLeftSidebar';
import LiveMapRightSidebar from './LiveMapRightSidebar';
import MapControls from '@/components/layout/MapControls';
import AppMenu from '@/components/layout/AppMenu';
import LivePinCard, { type LivePinData } from '@/components/layout/LivePinCard';
import { MapboxMapInstance } from '@/types/mapbox-events';

interface SimpleMapViewProps {
  /** Map identifier: UUID or slug (default: 'live') */
  identifier?: string;
  /** Show left sidebar */
  showLeftSidebar?: boolean;
  /** Show right sidebar */
  showRightSidebar?: boolean;
  /** Show map controls */
  showControls?: boolean;
}

/**
 * Simple Map View
 * Complete map page wrapper with sidebars and controls
 * Uses DynamicMapContainer internally
 */
export default function SimpleMapView({
  identifier = 'live',
  showLeftSidebar = true,
  showRightSidebar = true,
  showControls = true,
}: SimpleMapViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<LivePinData | null>(null);
  const [mapInstance, setMapInstance] = useState<MapboxMapInstance | null>(null);

  // Handle pin selection from URL
  const pinId = searchParams.get('pin');
  
  const handlePinSelect = useCallback((pinId: string, pinData?: any) => {
    if (pinData) {
      setSelectedPin(pinData as LivePinData);
    } else {
      // Fetch pin data
      fetch(`/api/maps/dynamic/${identifier}/pins?limit=1`)
        .then(res => res.json())
        .then(data => {
          const pin = data.pins?.find((p: any) => p.id === pinId);
          if (pin) {
            setSelectedPin(pin);
          }
        })
        .catch(() => setSelectedPin(null));
    }
  }, [identifier]);

  const handleClickReport = useCallback((lat: number, lng: number) => {
    // Handle click report
    console.log('Click report:', { lat, lng });
  }, []);

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Map Container */}
      <div className="flex-1 relative min-h-0">
        <DynamicMapContainer
          identifier={identifier}
          showPins={true}
          clusterPins={true}
          onMapLoad={setMapInstance}
          onPinSelect={handlePinSelect}
          onClickReport={handleClickReport}
        />
      </div>

      {/* Left Sidebar */}
      {showLeftSidebar && (
        <LiveMapLeftSidebar />
      )}

      {/* Right Sidebar */}
      {showRightSidebar && (
        <LiveMapRightSidebar />
      )}

      {/* Map Controls */}
      {showControls && mapInstance && (
        <MapControls map={mapInstance} />
      )}

      {/* App Menu */}
      <AppMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        liveBoundaryLayer={null}
        onLiveBoundaryLayerChange={() => {}}
        pinDisplayGrouping={true}
        onPinDisplayGroupingChange={() => {}}
        showOnlyMyPins={false}
        onShowOnlyMyPinsChange={() => {}}
        timeFilter={null}
        onTimeFilterChange={() => {}}
      />

      {/* Selected Pin Card */}
      {selectedPin && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4">
          <LivePinCard
            pin={selectedPin}
            onClose={() => setSelectedPin(null)}
          />
        </div>
      )}
    </div>
  );
}
