'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import ProfileLeftSidebar from '@/features/profiles/components/ProfileLeftSidebar';
import ProfilePinsMap, { type LocationPopupState } from '@/features/profiles/components/ProfilePinsMap';
import ProfileCardSlideDown from '@/features/profiles/components/ProfileCardSlideDown';
import FinishPinModal from '@/components/modals/FinishPinModal';
import { useProfileFollow } from '@/features/profiles/hooks/useProfileFollow';
import { useAuthStateSafe } from '@/features/auth';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import SignInGate from '@/components/auth/SignInGate';
import type { ProfileAccount } from '@/types/profile';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';

interface ProfileViewContentProps {
  account: ProfileAccount;
  pins: ProfilePin[];
  collections: Collection[];
  cityName?: string | null;
  isOwnProfile: boolean;
  /** True when the logged-in user owns this profile (used to show Owner/Public toggle even when viewing as public). */
  isProfileOwner?: boolean;
  isAuthenticated: boolean;
}

/**
 * Profile view layout: left sidebar (profile card, collections, analytics, live map),
 * center (Mapbox map of account pins), right sidebar (Sponsored, Following).
 */
export default function ProfileViewContent({
  account,
  pins,
  collections,
  cityName,
  isOwnProfile,
  isProfileOwner = isOwnProfile,
  isAuthenticated,
}: ProfileViewContentProps) {
  const router = useRouter();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [focusedPin, setFocusedPin] = useState<ProfilePin | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [dropPinMode, setDropPinMode] = useState(true);
  const [clickedCoordinates, setClickedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPopup, setLocationPopup] = useState<LocationPopupState>({
    isOpen: false,
    lat: 0,
    lng: 0,
    address: null,
    mapMeta: null,
  });
  const [finishPinModalPin, setFinishPinModalPin] = useState<ProfilePin | null>(null);
  const [finishPinModalAddress, setFinishPinModalAddress] = useState<string | null>(null);

  const { account: viewerAccount } = useAuthStateSafe();
  const { followSlot } = useProfileFollow(account.id, isOwnProfile, viewerAccount?.id);
  const { address: reverseGeocodeAddress } = useReverseGeocode(
    clickedCoordinates?.lat ?? null,
    clickedCoordinates?.lng ?? null
  );

  useEffect(() => {
    if (locationPopup.isOpen && reverseGeocodeAddress !== null) {
      setLocationPopup((prev) => ({ ...prev, address: reverseGeocodeAddress }));
    }
  }, [locationPopup.isOpen, reverseGeocodeAddress]);

  const handleMapClickForPin = useCallback((coords: { lat: number; lng: number }) => {
    setClickedCoordinates(coords);
    setLocationPopup({
      isOpen: true,
      lat: coords.lat,
      lng: coords.lng,
      address: null,
      mapMeta: null,
    });
  }, []);

  const handleLocationPopupClose = useCallback(() => {
    setLocationPopup((prev) => ({ ...prev, isOpen: false }));
    setClickedCoordinates(null);
  }, []);

  const handleAddPin = useCallback(
    async (coordinates: { lat: number; lng: number }, _mapMeta?: Record<string, unknown> | null, _mentionTypeId?: string | null) => {
      const addressToUse = locationPopup.address;
      const res = await fetch(`/api/accounts/${account.id}/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: coordinates.lat, lng: coordinates.lng }),
        credentials: 'include',
      });
      if (res.ok) {
        const { pin: createdPin } = await res.json();
        handleLocationPopupClose();
        setFinishPinModalAddress(addressToUse);
        setFinishPinModalPin(createdPin);
      }
    },
    [account.id, handleLocationPopupClose, locationPopup.address]
  );

  const visiblePins = useMemo(
    () => (isOwnProfile ? pins : pins.filter((p) => p.visibility === 'public')),
    [pins, isOwnProfile]
  );

  const handleSidebarPinClick = useCallback((pin: ProfilePin) => {
    setSelectedCollectionId(pin.collection_id ?? null);
    setFocusedPin(pin);
    setFocusTrigger((t) => t + 1);
  }, []);

  const leftSidebar = (
    <ProfileLeftSidebar
      account={account}
      cityName={cityName}
      collections={collections}
      pins={pins}
      isOwnProfile={isOwnProfile}
      isProfileOwner={isProfileOwner}
      selectedCollectionId={selectedCollectionId}
      onCollectionSelect={setSelectedCollectionId}
      followSlot={followSlot}
      onPinClick={handleSidebarPinClick}
    />
  );

  return (
    <NewPageWrapper leftSidebar={leftSidebar} mainNoScroll>
      <div className="h-full flex flex-col min-h-0 p-2">
        <div className="flex-1 min-h-0 relative rounded-md overflow-hidden border border-gray-200 dark:border-white/10 bg-surface-muted">
          <ProfilePinsMap
            pins={visiblePins}
            accountId={account.id}
            isOwnProfile={isOwnProfile}
            accountUsername={account.username}
            accountImageUrl={account.image_url}
            selectedCollectionId={selectedCollectionId}
            collections={collections}
            dropPinMode={isProfileOwner ? dropPinMode : false}
            onMapClickForPin={isProfileOwner ? handleMapClickForPin : undefined}
            locationPopup={locationPopup}
            onLocationPopupClose={handleLocationPopupClose}
            onAddPin={isProfileOwner ? handleAddPin : undefined}
            focusPin={focusedPin}
            focusTrigger={focusTrigger}
          />
          <ProfileCardSlideDown
            account={account}
            cityName={cityName}
            isOwnProfile={isOwnProfile}
            isProfileOwner={isProfileOwner}
            followSlot={followSlot}
            dropPinMode={dropPinMode}
            onDropPinModeChange={setDropPinMode}
          />
          {!isAuthenticated && (
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <SignInGate
                title={`Sign in to view ${account.username || account.first_name || 'this user'}'s profile`}
                description={`See full mentions, like posts, and connect with ${account.username || account.first_name || 'the community'}.`}
                subtle
              />
            </div>
          )}
        </div>
      </div>

      {finishPinModalPin && (
        <FinishPinModal
          isOpen={!!finishPinModalPin}
          onClose={() => {
            setFinishPinModalPin(null);
            setFinishPinModalAddress(null);
            router.refresh();
          }}
          pin={finishPinModalPin}
          accountId={account.id}
          address={finishPinModalAddress}
          onPinUpdated={() => router.refresh()}
          collections={collections}
        />
      )}
    </NewPageWrapper>
  );
}
