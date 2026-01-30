'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStateSafe, Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { isAccountComplete } from '@/lib/accountCompleteness';
import {
  HomeIcon,
  MapIcon,
  UserIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import ProfilePhoto from '../shared/ProfilePhoto';
import AppSearch from '@/features/search/components/AppSearch';
import BaseNav from '../shared/BaseNav';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import type { MapboxMetadata } from '@/types/mapbox';

export default function SimpleNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isMapPage = pathname?.startsWith('/map') ?? false;
  
  const {
    user,
    account,
    displayAccount,
    displayName,
    signOut,
    isLoading,
  } = useAuthStateSafe();
  
  const { openWelcome, openAccount, modal } = useAppModalContextSafe();
  
  // Check if user is authenticated but missing username - redirect to onboarding page
  useEffect(() => {
    // Only check when auth is loaded and user is authenticated
    if (isLoading) return;
    
    // If user is authenticated and account exists but username is missing
    if (user && account && !isAccountComplete(account)) {
      // Redirect to onboarding page instead of opening modal
      router.push('/onboarding');
    }
  }, [user, account, isLoading, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Nav links
  const navLinks = [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/maps', label: 'Map', icon: MapIcon },
    { href: '/contact', label: 'Contact', icon: EnvelopeIcon },
  ];

  // Profile link
  const profileLink = account?.username ? `/${account.username}` : null;

  // Right section with profile link and account dropdown
  const rightSection = displayAccount ? (
    <div className="flex items-center gap-0 h-full">
      {profileLink && (
        <Link
          href={profileLink}
          className="flex flex-col items-center justify-center px-2 h-full min-w-[44px] transition-colors text-gray-600 hover:text-gray-900"
        >
          <UserIcon className="w-4 h-4" />
          <span className="text-[9px] font-medium mt-0.5 leading-none">Profile</span>
        </Link>
      )}
      
      <div className="flex items-center justify-center px-2 h-full min-w-[44px]">
        <AccountDropdown
          onAccountClick={() => openAccount('settings')}
        />
      </div>
    </div>
  ) : (
    <button
      onClick={openWelcome}
      className="px-3 py-1 text-xs font-medium rounded-md transition-colors text-white bg-red-500 hover:bg-red-600"
    >
      Sign In
    </button>
  );

  const mobileMenuContent = (
    <div className="space-y-2">
      {navLinks.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="block px-3 py-2 text-base font-medium transition-colors text-gray-600 hover:text-black hover:bg-gray-100 flex items-center gap-2"
          >
            {Icon && <Icon className="w-5 h-5" />}
            {link.label}
          </Link>
        );
      })}
      <div className="pt-4 border-t border-gray-200">
        {user && account ? (
          <>
            <button
              onClick={() => openAccount('settings')}
              className="block w-full px-3 py-2.5 text-base font-medium transition-colors text-gray-600 hover:text-black hover:bg-gray-100 flex items-center gap-3 text-left"
            >
              <ProfilePhoto account={account} size="sm" />
              <span>{displayName}</span>
            </button>
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={handleSignOut}
                className="block w-full px-3 py-2.5 text-base font-medium transition-colors text-gray-600 hover:text-black hover:bg-gray-100 text-left"
              >
                Sign Out
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={openWelcome}
            className="block w-full px-3 py-2 text-base font-medium rounded-md transition-colors text-center text-white bg-red-500 hover:bg-red-600"
          >
            Sign In
          </button>
        )}
      </div>
    </div>
  );

  // Logo - always use logo.png
  const logo = '/logo.png';
  const logoAlt = 'For the Love of Minnesota';

  // Compact search for logged-in users
  const searchSection = user && account && !isMapPage ? (
    <div className="w-48 sm:w-56 lg:w-64 hidden md:block">
      <div className="compact-search-wrapper">
        <AppSearch 
          placeholder="Search" 
          onLocationSelect={(coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: MapboxMetadata) => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mapLocationSelect', {
                detail: { coordinates, placeName, mapboxMetadata }
              }));
            }
          }}
        />
      </div>
      <style jsx global>{`
        .compact-search-wrapper form { width: 100%; }
        .compact-search-wrapper input {
          height: 2rem !important;
          font-size: 0.875rem !important;
          padding-left: 2rem !important;
          padding-right: 0.75rem !important;
          background-color: #f3f2ef !important;
          border: 1px solid transparent !important;
          color: #1f2937 !important;
          border-radius: 0.25rem !important;
        }
        .compact-search-wrapper input::placeholder { color: #6b7280 !important; }
        .compact-search-wrapper input:focus {
          background-color: white !important;
          border-color: #c2b289 !important;
          outline: none !important;
          box-shadow: 0 0 0 1px #c2b289 !important;
        }
        .compact-search-wrapper .absolute.inset-y-0.left-0 { padding-left: 0.5rem !important; }
        .compact-search-wrapper .absolute.inset-y-0.left-0 svg {
          width: 1rem !important;
          height: 1rem !important;
          color: #6b7280 !important;
        }
        .compact-search-wrapper .absolute.top-full { margin-top: 0.5rem !important; }
      `}</style>
    </div>
  ) : null;

  return (
    <>
      <BaseNav
        navLinks={navLinks}
        bgColor="bg-white"
        borderColor="border-[#dfdedc]"
        logo={logo}
        logoAlt={logoAlt}
        rightSection={rightSection}
        showScrollEffect={true}
        mobileMenuContent={mobileMenuContent}
        searchSection={searchSection}
      />
      
    </>
  );
}
