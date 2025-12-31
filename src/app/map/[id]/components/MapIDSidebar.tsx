'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { UserIcon, InformationCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Account } from '@/features/auth';
import SecondarySidebar from '@/features/sidebar/components/SecondarySidebar';
import ProfileAccountsSecondaryContent from '@/features/sidebar/components/ProfileAccountsSecondaryContent';
import MapIDMenu from './MapIDMenu';

interface MapIDSidebarProps {
  account: Account | null;
  detailsContent?: React.ReactNode;
}

export default function MapIDSidebar({ account, detailsContent }: MapIDSidebarProps) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);

  return (
    <>
      {/* Left Sidebar - Simplified version with logo, details, and profile */}
      <aside className="fixed left-0 top-0 bottom-0 z-[100] w-16 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo - Top */}
        <div className="flex items-center justify-center h-14">
          <button
            onClick={() => router.push('/maps')}
            onMouseEnter={() => setLogoHovered(true)}
            onMouseLeave={() => setLogoHovered(false)}
            className="hover:opacity-80 transition-opacity flex items-center justify-center"
            title="Back to Maps"
            aria-label="Back to Maps"
          >
            {logoHovered ? (
              <ArrowLeftIcon className="w-6 h-6 text-gray-900" />
            ) : (
              <Image
                src="/logo.png"
                alt="Logo"
                width={24}
                height={24}
                className="w-6 h-6"
                unoptimized
              />
            )}
          </button>
        </div>

        {/* Details Button */}
        <div className="border-b border-gray-200 py-2">
          <button
            onClick={() => setDetailsOpen(true)}
            className={`w-full flex flex-col items-center justify-center gap-1 py-2 px-2 transition-colors ${
              detailsOpen
                ? 'text-gray-900 bg-gray-100'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title="Details"
            aria-label="Details"
          >
            <InformationCircleIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Details</span>
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Section - Profile */}
        <div className="border-t border-gray-200 py-2">
          <button
            onClick={() => setProfileOpen(true)}
            className={`w-full flex flex-col items-center justify-center gap-1 py-2 px-2 transition-colors ${
              profileOpen
                ? 'text-gray-900 bg-gray-100'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title="Profile"
            aria-label="Profile"
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
      </aside>

      {/* Details Menu */}
      {detailsOpen && detailsContent && (
        <MapIDMenu
          isOpen={true}
          label="Details"
          onClose={() => setDetailsOpen(false)}
        >
          {detailsContent}
        </MapIDMenu>
      )}

      {/* Secondary Sidebar - Profile */}
      {profileOpen && (
        <SecondarySidebar
          isOpen={true}
          label="Profile"
          onClose={() => setProfileOpen(false)}
        >
          <ProfileAccountsSecondaryContent />
        </SecondarySidebar>
      )}
    </>
  );
}

