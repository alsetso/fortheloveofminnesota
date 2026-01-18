'use client';

import { useMemo, useEffect, useRef } from 'react';
import ProfileMap from './ProfileMap';
import ProfileModal from './ProfileModal';
import MapProfileHeader from './MapProfileHeader';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import { useToast } from '@/features/ui/hooks/useToast';

interface ProfilePageMapViewProps {
  account: ProfileAccount;
  pins: ProfilePin[];
  collections: Collection[];
  isOwnProfile: boolean;
}

export default function ProfilePageMapView({
  account,
  pins,
  collections,
  isOwnProfile,
}: ProfilePageMapViewProps) {
  const { info } = useToast();
  const hasShownToastRef = useRef(false);
  
  // Filter pins - show public ones for visitors, all for owners
  const filteredPins = useMemo(() => {
    return pins.filter(pin => isOwnProfile || pin.visibility === 'public');
  }, [pins, isOwnProfile]);

  // Show toast when viewing own profile (only once)
  useEffect(() => {
    if (isOwnProfile && !hasShownToastRef.current) {
      info('Viewing your profile');
      hasShownToastRef.current = true;
    }
  }, [isOwnProfile, info]);

  return (
    <div className="profileScreenContainer h-screen w-screen overflow-hidden fixed inset-0">
      <div className="fixed inset-0" style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
        {/* Full Screen Map */}
        <ProfileMap 
          pins={filteredPins} 
          accountId={account.id}
          isOwnProfile={isOwnProfile}
          accountUsername={account.username}
          accountImageUrl={account.image_url}
          selectedCollectionId={null}
          collections={collections}
        />

        {/* Floating Map Profile Header - Top */}
        <MapProfileHeader isOwnProfile={isOwnProfile} />

        {/* Profile Modal - iOS Style Bottom Sheet (z-50, appears in front of header) */}
        <ProfileModal 
          account={account} 
          isOwnProfile={isOwnProfile}
          collections={collections}
          pins={pins}
          onAccountUpdate={(updatedAccount) => {
            // Update account in parent if needed
          }}
        />
      </div>
    </div>
  );
}
