'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth';
import { AccountService, Account } from '@/features/auth';
import { GuestAccountService, type GuestAccount } from '@/features/auth/services/guestAccountService';
import { useProfile } from '@/features/profiles/contexts/ProfileContext';
import {
  HomeIcon,
  MapIcon,
  GlobeAltIcon,
  BuildingStorefrontIcon,
  BellIcon,
  UserIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { isAccountComplete } from '@/lib/accountCompleteness';
import { useNotifications } from '@/features/notifications';
import ProfilePhoto from './ProfilePhoto';
import AppSearch from './app/AppSearch';
import BaseNav from './shared/BaseNav';
import GuestDetailsModal from './auth/GuestDetailsModal';

export default function SimpleNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isMapPage = pathname?.startsWith('/map') ?? false;
  const { user, signOut } = useAuth();
  const { selectedProfile } = useProfile();
  const [account, setAccount] = useState<Account | null>(null);
  const [guestAccount, setGuestAccount] = useState<GuestAccount | null>(null);
  const [hasCompletedGuestProfile, setHasCompletedGuestProfile] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const {
    notifications,
    loading: notificationsLoading,
    unreadCount,
    markAsRead: markAsReadNotification,
  } = useNotifications({
    limit: 10,
    unreadOnly: false,
    autoLoad: !!user && !!account,
  });
  const accountContainerRef = useRef<HTMLDivElement>(null);

  // Load account data
  useEffect(() => {
    const loadAccount = async () => {
      if (user) {
        // Authenticated user
        try {
          const accountData = await AccountService.getCurrentAccount();
          setAccount(accountData);
          setGuestAccount(null);
        } catch (error) {
          console.error('Error loading account:', error);
          setAccount(null);
        }
      } else {
        // Guest user
        setAccount(null);
        
        // Check if guest profile is complete
        const guestName = GuestAccountService.getGuestName();
        if (guestName && guestName.trim() && guestName !== 'Guest') {
          setHasCompletedGuestProfile(true);
          
          // Fetch guest account from Supabase
          try {
            const guestId = GuestAccountService.getGuestId();
            const account = await GuestAccountService.getGuestAccountByGuestId(guestId);
            if (account) {
              setGuestAccount(account);
            } else {
              // Try to create if it doesn't exist
              try {
                const newAccount = await GuestAccountService.getOrCreateGuestAccount();
                setGuestAccount(newAccount);
              } catch (error) {
                console.error('[SimpleNav] Error creating guest account:', error);
              }
            }
          } catch (error) {
            console.error('[SimpleNav] Error fetching guest account:', error);
          }
        } else {
          setHasCompletedGuestProfile(false);
          setGuestAccount(null);
        }
      }
    };

    loadAccount();
  }, [user]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountContainerRef.current && !accountContainerRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    if (isAccountMenuOpen) {
      // Use click event (bubble phase) so link onClick handlers fire first
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
    return undefined;
  }, [isAccountMenuOpen]);


  const markAsRead = async (notificationId: string) => {
    try {
      await markAsReadNotification(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      setIsAccountMenuOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const displayName = account ? AccountService.getDisplayName(account) : user?.email || 'User';
  const planName = account?.plan ? account.plan.charAt(0).toUpperCase() + account.plan.slice(1) : 'Account';

  // Build nav links - left side nav (excludes Pages which goes on right)
  const navLinks = user && account ? [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/explore', label: 'Explore', icon: GlobeAltIcon },
    { href: '/faqs', label: 'FAQs', icon: QuestionMarkCircleIcon },
  ] : [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/explore', label: 'Explore', icon: GlobeAltIcon },
    { href: '/faqs', label: 'FAQs', icon: QuestionMarkCircleIcon },
  ];

  // Account dropdown component (reusable) - defined before rightSection
  const AccountDropdown = () => (
    <>
      {isAccountMenuOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] sm:max-w-none bg-white z-50 overflow-hidden rounded-md border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-0.5">
            {/* User Info */}
            <div className="p-[10px] border-b border-gray-200">
              <p className="text-xs font-medium text-gray-900">{user?.email}</p>
              <p className="text-xs text-gray-500 mt-0.5">{planName}</p>
            </div>

            {/* Navigation Links */}
            <Link
              href="/account/settings"
              onClick={(e) => {
                e.stopPropagation();
                setIsAccountMenuOpen(false);
              }}
              className="flex items-center gap-1.5 p-[10px] text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <UserIcon className="w-3 h-3 text-gray-500" />
              Account
            </Link>
            <Link
              href="/account/analytics"
              onClick={(e) => {
                e.stopPropagation();
                setIsAccountMenuOpen(false);
              }}
              className="flex items-center gap-1.5 p-[10px] text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <ChartBarIcon className="w-3 h-3 text-gray-500" />
              Analytics
            </Link>
            <Link
              href="/account/settings"
              onClick={(e) => {
                e.stopPropagation();
                setIsAccountMenuOpen(false);
              }}
              className="flex items-center gap-1.5 p-[10px] text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
            <Link
              href="/account/billing"
              onClick={(e) => {
                e.stopPropagation();
                setIsAccountMenuOpen(false);
              }}
              className="flex items-center gap-1.5 p-[10px] text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Billing
            </Link>
            {/* Notifications */}
            <Link
              href="/account/notifications"
              onClick={(e) => {
                e.stopPropagation();
                setIsAccountMenuOpen(false);
              }}
              className="flex items-center gap-1.5 p-[10px] text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors relative"
            >
              <BellIcon className="w-3 h-3 text-gray-500" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
              )}
            </Link>
            {/* Sign Out */}
            <div className="border-t border-gray-200 mt-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSignOut();
                }}
                className="flex items-center gap-1.5 w-full p-[10px] text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Right section - Me dropdown or Guest account
  const rightSection = user && account ? (
    <div className="flex items-center gap-1">
      {/* Me dropdown - far right */}
      <div ref={accountContainerRef} className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAccountMenuOpen(!isAccountMenuOpen);
          }}
          className="flex flex-col items-center justify-center px-1.5 sm:px-2 py-1 min-w-[50px] sm:min-w-[60px] transition-all duration-200 text-gray-700 hover:text-gold-600"
          aria-label="Account menu"
          aria-expanded={isAccountMenuOpen}
        >
          <div className="mb-0.5">
            {user && account ? <ProfilePhoto account={account} size="sm" /> : (
              <div className="w-5 h-5 rounded-full bg-gray-300" />
            )}
          </div>
          <span className="text-[9px] sm:text-[10px] font-medium mt-0.5">Me</span>
        </button>
        <AccountDropdown />
      </div>
    </div>
  ) : hasCompletedGuestProfile && guestAccount ? (
    <div className="flex items-center gap-1">
      {/* Guest account - far right */}
      <div ref={accountContainerRef} className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsGuestModalOpen(true);
          }}
          className="flex flex-col items-center justify-center px-1.5 sm:px-2 py-1 min-w-[50px] sm:min-w-[60px] transition-all duration-200 text-gray-700 hover:text-gold-600"
          aria-label="Guest account"
        >
          <div className="mb-0.5">
            <ProfilePhoto account={guestAccount as Account} size="sm" />
          </div>
          <span className="text-[9px] sm:text-[10px] font-medium mt-0.5">Guest</span>
        </button>
      </div>
    </div>
  ) : (
    <Link
      href="/?modal=account&tab=settings"
      className="px-4 py-1.5 text-sm font-medium border rounded transition-all duration-200 text-blue-600 border-blue-600 hover:bg-blue-50"
    >
      Sign In
    </Link>
  );



  const mobileMenuContent = (
    <>
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
              <Link
                href="/account/settings"
                className="block px-3 py-2.5 text-base font-medium transition-colors text-gray-600 hover:text-black hover:bg-gray-100 flex items-center gap-3"
              >
                <ProfilePhoto account={account} size="sm" />
                <span>{displayName}</span>
              </Link>
              <Link
                href="/account/notifications"
                className="block px-3 py-2.5 text-base font-medium transition-colors text-gray-600 hover:text-black hover:bg-gray-100 flex items-center gap-3 relative"
              >
                <BellIcon className="w-5 h-5" />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <div className="pt-2 border-t border-gray-200">
                <button
                  onClick={handleSignOut}
                  className="block w-full px-3 py-2.5 text-base font-medium transition-colors text-gray-600 hover:text-black hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : hasCompletedGuestProfile && guestAccount ? (
            <>
              <button
                onClick={() => setIsGuestModalOpen(true)}
                className="block w-full px-3 py-2.5 text-base font-medium transition-colors text-gray-600 hover:text-black hover:bg-gray-100 flex items-center gap-3"
              >
                <ProfilePhoto account={guestAccount as Account} size="sm" />
                <span>{guestAccount.first_name || 'Guest'}</span>
              </button>
              <Link
                href="/?modal=account&tab=settings"
                className="block px-3 py-2 text-base font-medium border-2 rounded-lg transition-colors text-center text-blue-600 border-blue-600 hover:bg-blue-50 mt-2"
              >
                Sign In
              </Link>
            </>
          ) : (
            <Link
              href="/?modal=account&tab=settings"
              className="block px-3 py-2 text-base font-medium border-2 rounded-lg transition-colors text-center text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </>
  );

  // Determine logo based on auth state
  const logo = user && account ? '/logo.png' : '/word_logo.png';
  const logoAlt = user && account ? 'MNUDA Emblem' : 'MNUDA';

  // Compact search component for logged-in users (LinkedIn style - immediately after logo)
  // Hide search on map pages - it will be shown in MapToolbar instead
  const searchSection = user && account && !isMapPage ? (
    <div className="w-48 sm:w-56 lg:w-64 hidden md:block">
      <div className="compact-search-wrapper">
        <AppSearch 
          placeholder="Search" 
          onLocationSelect={(coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: MapboxMetadata) => {
            // Dispatch custom event for map page to handle
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mapLocationSelect', {
                detail: { coordinates, placeName, mapboxMetadata }
              }));
            }
          }}
        />
      </div>
      <style jsx global>{`
        .compact-search-wrapper form {
          width: 100%;
        }
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
        .compact-search-wrapper input::placeholder {
          color: #6b7280 !important;
        }
        .compact-search-wrapper input:focus {
          background-color: white !important;
          border-color: #c2b289 !important;
          outline: none !important;
          box-shadow: 0 0 0 1px #c2b289 !important;
        }
        .compact-search-wrapper .absolute.inset-y-0.left-0 {
          padding-left: 0.5rem !important;
        }
        .compact-search-wrapper .absolute.inset-y-0.left-0 svg {
          width: 1rem !important;
          height: 1rem !important;
          color: #6b7280 !important;
        }
        .compact-search-wrapper .absolute.top-full {
          margin-top: 0.5rem !important;
        }
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
      
      {/* Guest Details Modal */}
      <GuestDetailsModal
        isOpen={isGuestModalOpen}
        onClose={() => {
          setIsGuestModalOpen(false);
          // Refresh guest account after closing
          if (!user) {
            const guestName = GuestAccountService.getGuestName();
            if (guestName && guestName.trim() && guestName !== 'Guest') {
              setHasCompletedGuestProfile(true);
            }
          }
        }}
        onComplete={async () => {
          // Verify account was created and mark profile as complete
          try {
            const guestId = GuestAccountService.getGuestId();
            const account = await GuestAccountService.getGuestAccountByGuestId(guestId);
            if (account) {
              setGuestAccount(account);
              setHasCompletedGuestProfile(true);
            } else {
              await GuestAccountService.getOrCreateGuestAccount();
              setHasCompletedGuestProfile(true);
            }
          } catch (error) {
            console.error('[SimpleNav] Error completing guest profile:', error);
          }
        }}
        onSignIn={async () => {
          setIsGuestModalOpen(false);
          // Clean guest parameters before redirecting
          const { cleanAuthParams } = await import('@/lib/urlParams');
          cleanAuthParams(router);
          router.push('/?modal=account&tab=settings');
        }}
      />
    </>
  );
}

