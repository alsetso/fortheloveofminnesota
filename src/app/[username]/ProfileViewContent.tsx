'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import ProfileLeftSidebar from '@/features/profiles/components/ProfileLeftSidebar';
import ProfilePinsMap, { type LocationPopupState } from '@/features/profiles/components/ProfilePinsMap';
import ProfileCardSlideDown from '@/features/profiles/components/ProfileCardSlideDown';
import { useProfileFollow } from '@/features/profiles/hooks/useProfileFollow';
import { useAuthStateSafe } from '@/features/auth';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import SignInGate from '@/components/auth/SignInGate';
import FinishPinModal from '@/components/modals/FinishPinModal';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
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

  const { account: viewerAccount } = useAuthStateSafe();
  const { addToast } = useToastContext();
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
    if (!MinnesotaBoundsService.isWithinMinnesota(coords)) {
      addToast(createToast('info', 'Pins can only be placed within Minnesota', { duration: 3000 }));
      return;
    }
    setClickedCoordinates(coords);
    setLocationPopup({
      isOpen: true,
      lat: coords.lat,
      lng: coords.lng,
      address: null,
      mapMeta: null,
    });
  }, [addToast]);

  const handleLocationPopupClose = useCallback(() => {
    setLocationPopup((prev) => ({ ...prev, isOpen: false }));
    setClickedCoordinates(null);
  }, []);

  // Finish-pin modal state
  const [finishPin, setFinishPin] = useState<ProfilePin | null>(null);
  const [finishPinAddress, setFinishPinAddress] = useState<string | null>(null);

  const handlePinCreated = useCallback((pin: ProfilePin) => {
    handleLocationPopupClose();
    // Open finish-pin modal so owner can add description, media, collection
    setFinishPin(pin);
    setFinishPinAddress(locationPopup.address);
    router.refresh();
  }, [handleLocationPopupClose, locationPopup.address, router]);

  const handleFinishPinUpdated = useCallback((_updatedPin: ProfilePin) => {
    setFinishPin(null);
    setFinishPinAddress(null);
    router.refresh();
  }, [router]);

  const handleFinishPinClose = useCallback(() => {
    setFinishPin(null);
    setFinishPinAddress(null);
  }, []);

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
            onPinCreated={isProfileOwner ? handlePinCreated : undefined}
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
      {finishPin && (
        <FinishPinModal
          isOpen
          onClose={handleFinishPinClose}
          pin={finishPin}
          accountId={account.id}
          address={finishPinAddress}
          onPinUpdated={handleFinishPinUpdated}
          collections={collections}
        />
      )}
    </NewPageWrapper>
  );
}
