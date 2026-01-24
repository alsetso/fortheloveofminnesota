'use client';

import { ReactNode, useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import ProfileCard from './ProfileCard';
import type { ProfileAccount } from '@/types/profile';
import SimpleNav from '@/components/layout/SimpleNav';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f2ef] flex flex-col">
      {/* Header */}
      <SimpleNav />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          {isMobileMenuOpen ? (
            <>
              <XMarkIcon className="w-5 h-5" />
              <span>Close Menu</span>
            </>
          ) : (
            <>
              <Bars3Icon className="w-5 h-5" />
              <span>Menu</span>
            </>
          )}
        </button>

        {/* Left Sidebar - Profile Card & Navigation */}
        <aside
          className={`${
            isMobileMenuOpen ? 'block' : 'hidden'
          } lg:block w-full lg:w-64 flex-shrink-0`}
        >
          <div className="lg:sticky lg:top-6">
            {/* Profile Card */}
            <ProfileCard
              account={account}
              isOwnProfile={isOwnProfile}
              showViewProfile={false}
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
