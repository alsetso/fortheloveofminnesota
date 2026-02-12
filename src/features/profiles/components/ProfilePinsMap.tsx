'use client';

import { useState, useCallback } from 'react';
import ProfileMap from './ProfileMap';
import LocationSelectPopup from '@/components/layout/LocationSelectPopup';
import { usePinMarker } from '@/hooks/usePinMarker';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import type { MapboxMapInstance } from '@/types/mapbox-events';

export interface LocationPopupState {
  isOpen: boolean;
  lat: number;
  lng: number;
  address: string | null;
  mapMeta?: Record<string, unknown> | null;
}

interface ProfilePinsMapProps {
  pins: ProfilePin[];
  accountId: string;
  isOwnProfile: boolean;
  accountUsername?: string | null;
  accountImageUrl?: string | null;
  selectedCollectionId?: string | null;
  collections?: Collection[];
  onPinSelect?: (pinId: string | null) => void;
  /** When true, map click opens location popup and shows temp pin (owner only). */
  dropPinMode?: boolean;
  /** Called when user clicks map in drop-pin mode. Parent should open location popup with coords. */
  onMapClickForPin?: (coords: { lat: number; lng: number }) => void;
  /** Controlled location popup state (for temp pin + slide-up modal). */
  locationPopup?: LocationPopupState;
  onLocationPopupClose?: () => void;
  /** When user confirms "Add to map" in popup (profile: create pin via API). */
  onAddPin?: (coordinates: { lat: number; lng: number }, mapMeta?: Record<string, unknown> | null, mentionTypeId?: string | null) => void;
  /** When set, fly to this pin and open its popup (e.g. from sidebar click). */
  focusPin?: ProfilePin | null;
  /** Incremented on each focus request; use in effect deps so same-pin reclick retriggers. */
  focusTrigger?: number;
}

/**
 * Full-height Mapbox container for an account's pins on the profile page.
 * Fills the main content area; collection filter is driven by parent (left sidebar).
 * When dropPinMode and owner: map click shows temp pin and LocationSelectPopup (slide-up).
 */
export default function ProfilePinsMap({
  pins,
  accountId,
  isOwnProfile,
  accountUsername,
  accountImageUrl,
  selectedCollectionId,
  collections,
  onPinSelect,
  dropPinMode = false,
  onMapClickForPin,
  locationPopup,
  onLocationPopupClose,
  onAddPin,
  focusPin,
  focusTrigger = 0,
}: ProfilePinsMapProps) {
  const [mapInstance, setMapInstance] = useState<MapboxMapInstance | null>(null);

  const pinCoordinates =
    locationPopup?.isOpen && locationPopup.lat && locationPopup.lng
      ? { lat: locationPopup.lat, lng: locationPopup.lng }
      : null;

  usePinMarker({
    map: mapInstance,
    coordinates: pinCoordinates,
    color: 'white',
    enabled: !!locationPopup?.isOpen && !!pinCoordinates && !!mapInstance,
  });

  const handleMapInstanceReady = useCallback((map: MapboxMapInstance) => {
    setMapInstance(map);
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] relative overflow-hidden bg-surface-muted">
      <ProfileMap
        pins={pins}
        accountId={accountId}
        isOwnProfile={isOwnProfile}
        accountUsername={accountUsername}
        accountImageUrl={accountImageUrl}
        selectedCollectionId={selectedCollectionId}
        collections={collections}
        onPinSelect={onPinSelect}
        dropPinMode={dropPinMode}
        onMapClick={onMapClickForPin}
        onMapInstanceReady={handleMapInstanceReady}
        focusPin={focusPin}
        focusTrigger={focusTrigger}
      />
      {locationPopup && (
        <LocationSelectPopup
          isOpen={locationPopup.isOpen}
          onClose={onLocationPopupClose ?? (() => {})}
          lat={locationPopup.lat}
          lng={locationPopup.lng}
          address={locationPopup.address}
          mapMeta={locationPopup.mapMeta ?? undefined}
          onAddToMap={onAddPin}
          allowPins
          isOwner={isOwnProfile}
        />
      )}
    </div>
  );
}
