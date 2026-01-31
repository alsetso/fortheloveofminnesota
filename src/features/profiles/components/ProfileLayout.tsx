'use client';

import { ReactNode } from 'react';
import ProfileCard from './ProfileCard';
import type { ProfileAccount } from '@/types/profile';

interface ProfileLayoutProps {
  account: ProfileAccount;
  isOwnProfile: boolean;
  children: ReactNode;
}

export default function ProfileLayout({
  account,
  isOwnProfile,
  children,
}: ProfileLayoutProps) {
  // All profiles use 600px max width to match header navigation center
  const maxWidthClass = 'max-w-[600px]';
  
  return (
    <div className={`flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6 ${maxWidthClass} mx-auto w-full`}>
      {/* Profile Card - Stacked above content on both desktop and mobile */}
      <div className="w-full">
        <ProfileCard
          account={account}
          isOwnProfile={isOwnProfile}
          showViewProfile={false}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 w-full">
        {children}
      </main>
    </div>
  );
}
