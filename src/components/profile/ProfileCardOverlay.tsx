'use client';

import Image from 'next/image';
import Link from 'next/link';
import { 
  UserIcon,
  MapPinIcon,
  CalendarIcon,
  PencilSquareIcon,
  LockClosedIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';

interface AccountData {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  guest_id: string | null;
  user_id: string | null;
  created_at: string;
}

interface ProfileCardOverlayProps {
  account: AccountData;
  displayName: string;
  joinDate: string;
  publicPinsCount: number;
  privatePinsCount: number;
  isOwnProfile: boolean;
  isGuest: boolean;
}

export default function ProfileCardOverlay({
  account,
  displayName,
  joinDate,
  publicPinsCount,
  privatePinsCount,
  isOwnProfile,
  isGuest,
}: ProfileCardOverlayProps) {
  const totalPins = publicPinsCount + privatePinsCount;

  const handleShare = async () => {
    const url = `${window.location.origin}/profile/${account.username}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName}'s Profile on MNUDA`,
          text: `Check out ${displayName}'s pins on MNUDA - For the Love of Minnesota`,
          url,
        });
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        alert('Profile link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[280px]">
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg overflow-hidden">
        {/* Header with gradient */}
        <div className="relative h-16 bg-gradient-to-r from-gray-800 to-gray-900">
          {/* Profile Photo */}
          <div className="absolute -bottom-6 left-4">
            <div className="w-14 h-14 rounded-full bg-white border-2 border-white shadow-md overflow-hidden">
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={displayName}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                  unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-gray-400" />
                </div>
              )}
            </div>
          </div>
          
          {/* Guest Badge */}
          {isGuest && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 bg-gray-700/80 text-white text-[10px] font-medium rounded">
                Guest
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="pt-8 pb-3 px-4">
          {/* Name and username */}
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-900 leading-tight">
              {displayName}
            </h2>
            {account.username && (
              <p className="text-xs text-gray-500">@{account.username}</p>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <MapPinIcon className="w-3 h-3 text-gray-400" />
              <span>{publicPinsCount} public pin{publicPinsCount !== 1 ? 's' : ''}</span>
            </div>
            {isOwnProfile && privatePinsCount > 0 && (
              <div className="flex items-center gap-1">
                <LockClosedIcon className="w-3 h-3 text-gray-400" />
                <span>{privatePinsCount} private</span>
              </div>
            )}
          </div>

          {/* Join Date */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <CalendarIcon className="w-3 h-3" />
            <span>Joined {joinDate}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            {isOwnProfile ? (
              <>
                <Link
                  href="/?modal=account&tab=settings"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
                >
                  <PencilSquareIcon className="w-3 h-3" />
                  Edit Profile
                </Link>
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center px-3 py-2 border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors"
                  title="Share profile"
                >
                  <ShareIcon className="w-3 h-3" />
                </button>
              </>
            ) : (
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                <ShareIcon className="w-3 h-3" />
                Share Profile
              </button>
            )}
          </div>
        </div>

        {/* Empty state message */}
        {totalPins === 0 && (
          <div className="px-4 pb-3 text-center">
            <p className="text-xs text-gray-500">
              {isOwnProfile 
                ? 'Double-click on the map to add your first pin!'
                : 'No public pins yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


