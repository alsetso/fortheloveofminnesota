'use client';

import ProfilePinsList from './ProfilePinsList';
import type { ProfilePin } from '@/types/profile';
interface ProfilePinsSidebarProps {
  pins: ProfilePin[];
  isOwnProfile: boolean;
  onPinClick?: (pin: ProfilePin) => void;
}

export default function ProfilePinsSidebar({ 
  pins, 
  isOwnProfile,
  onPinClick,
}: ProfilePinsSidebarProps) {
  if (pins.length === 0) {
    return null;
  }

  return (
    <div className="hidden xl:block fixed right-0 top-24 h-[calc(100vh-6rem)] w-[225px] bg-white border-l border-gray-200 z-30 overflow-y-auto">
      <div className="p-[10px]">
        <ProfilePinsList pins={pins} isOwnProfile={isOwnProfile} onPinClick={onPinClick} />
      </div>
    </div>
  );
}
