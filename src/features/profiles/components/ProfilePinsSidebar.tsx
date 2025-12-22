'use client';

import ProfilePinsList from './ProfilePinsList';
import type { ProfilePin } from '@/types/profile';
import type { MapPin } from '@/types/map-pin';

interface ProfilePinsSidebarProps {
  pins: ProfilePin[];
  isOwnProfile: boolean;
  onPinClick?: (pin: ProfilePin) => void;
}

/**
 * Converts ProfilePin to MapPin for compatibility with ProfilePinsList
 */
function convertProfilePinToMapPin(pin: ProfilePin): MapPin {
  return {
    id: pin.id,
    lat: pin.lat,
    lng: pin.lng,
    description: pin.description,
    type: null,
    media_url: pin.media_url,
    account_id: null,
    city_id: null,
    county_id: null,
    visibility: pin.visibility,
    created_at: pin.created_at,
    updated_at: pin.updated_at,
  };
}

export default function ProfilePinsSidebar({ 
  pins, 
  isOwnProfile,
  onPinClick,
}: ProfilePinsSidebarProps) {
  // Convert ProfilePin[] to MapPin[] and maintain mapping
  const pinMap = new Map<string, ProfilePin>();
  const mapPins: MapPin[] = pins.map((pin) => {
    const mapPin = convertProfilePinToMapPin(pin);
    pinMap.set(mapPin.id, pin);
    return mapPin;
  });

  if (pins.length === 0) {
    return null;
  }

  const handlePinClick = (mapPin: MapPin) => {
    if (onPinClick) {
      const profilePin = pinMap.get(mapPin.id);
      if (profilePin) {
        onPinClick(profilePin);
      }
    }
  };

  return (
    <div className="hidden xl:block fixed right-0 top-24 h-[calc(100vh-6rem)] w-[225px] bg-white border-l border-gray-200 z-30 overflow-y-auto">
      <div className="p-[10px]">
        <ProfilePinsList pins={mapPins} isOwnProfile={isOwnProfile} onPinClick={handlePinClick} />
      </div>
    </div>
  );
}
