'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeftIcon, UserIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import MapTopContainer from '@/components/layout/MapTopContainer';

interface MapProfileHeaderProps {
  isOwnProfile: boolean;
}

export default function MapProfileHeader({ isOwnProfile }: MapProfileHeaderProps) {
  const router = useRouter();
  const { account } = useAuthStateSafe();

  // Get current visitor's account image
  const visitorImageUrl = account?.image_url || null;
  const visitorDisplayName = account 
    ? (account.first_name 
        ? `${account.first_name}${account.last_name ? ` ${account.last_name}` : ''}`
        : account.username || 'User')
    : 'User';

  const handleAccountImageClick = () => {
    if (account?.username) {
      router.push(`/profile/${account.username}`);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-center gap-2 px-3 py-2">
      {/* MapTopContainer - Centered */}
      <div className="flex-1 max-w-2xl mx-auto">
        <MapTopContainer />
      </div>
    </div>
  );
}
