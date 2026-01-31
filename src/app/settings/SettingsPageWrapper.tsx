'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Cog6ToothIcon,
  MapIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  ChevronRightIcon,
  CreditCardIcon,
  BanknotesIcon,
  MapPinIcon,
  ClockIcon,
  Square3Stack3DIcon,
  BuildingOfficeIcon,
  UsersIcon,
  IdentificationIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { SettingsProvider, useSettings } from '@/features/settings/contexts/SettingsContext';
import { useAuth } from '@/features/auth';
import { getDisplayName } from '@/types/profile';
import type { ProfileAccount } from '@/types/profile';

interface SettingsPageWrapperProps {
  account: ProfileAccount;
  userEmail: string;
  /** Map limit from accounts.plan (hobby=1, contributor=5). */
  mapLimit: number;
  children: React.ReactNode;
}

const SUBPAGE_BACK_TITLES: Record<string, string> = {
  '/settings/accounts': 'Accounts',
  '/settings/general': 'General',
  '/settings/maps': 'Maps',
  '/settings/maps/pins': 'Pin Display',
  '/settings/pins': 'Pins',
  '/settings/collections': 'Collections',
  '/settings/privacy': 'Privacy',
  '/settings/account': 'Account',
  '/settings/id': 'ID Verification',
  '/settings/history': 'History',
  '/settings/plans': 'Plans',
  '/settings/billing': 'Billing',
  '/settings/usage': 'Usage',
  '/settings/business': 'Business',
  '/settings/government': 'Government',
};

const PLAN_LABELS: Record<string, string> = {
  hobby: 'Hobby',
  contributor: 'Contributor',
  plus: 'Pro+',
  business: 'Business',
  gov: 'Government',
};

function SettingsNavAndContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { account, userEmail } = useSettings();
  const { signOut } = useAuth();
  const isMainSettings = pathname === '/settings';
  const isAdmin = account?.role === 'admin';

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const displayName = getDisplayName(account);
  const subtitle = account.username ? `@${account.username}` : userEmail || '';
  const planLabel = (account.plan && PLAN_LABELS[account.plan]) || 'Hobby';
  const hasPaidPlanBorder = account.plan === 'contributor' || account.plan === 'plus';
  const canUpgrade = !account.plan || account.plan === 'hobby' || account.plan === 'contributor';

  const handleSignOutClick = () => setShowSignOutConfirm(true);

  const handleSignOutConfirm = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    setShowSignOutConfirm(false);
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setSignOutError('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOutCancel = () => setShowSignOutConfirm(false);

  const adminNavItems = isAdmin
    ? [{ label: 'Accounts', href: '/settings/accounts', Icon: UsersIcon, iconColor: 'text-gray-600' }]
    : [];

  const generalNavItems = [
    { label: 'General', href: '/settings/general', Icon: Cog6ToothIcon, iconColor: 'text-gray-500' },
    { label: 'Maps', href: '/settings/maps', Icon: MapIcon, iconColor: 'text-blue-500' },
    { label: 'Pins', href: '/settings/pins', Icon: MapPinIcon, iconColor: 'text-red-500' },
    { label: 'Collections', href: '/settings/collections', Icon: Square3Stack3DIcon, iconColor: 'text-purple-500' },
    { label: 'Business', href: '/settings/business', Icon: BuildingOfficeIcon, iconColor: 'text-blue-600' },
  ] as const;

  const accountPrivacyNavItems = [
    { label: 'Privacy', href: '/settings/privacy', Icon: ShieldCheckIcon, iconColor: 'text-green-500' },
    { label: 'Account', href: '/settings/account', Icon: UserCircleIcon, iconColor: 'text-indigo-600' },
    { label: 'History', href: '/settings/history', Icon: ClockIcon, iconColor: 'text-amber-500' },
    { label: 'ID Verification', href: '/settings/id', Icon: IdentificationIcon, iconColor: 'text-cyan-600' },
  ] as const;

  const billingNavItems = [
    { label: 'Plans', href: '/settings/plans', Icon: CreditCardIcon, iconColor: 'text-violet-500' },
    { label: 'Billing', href: '/settings/billing', Icon: BanknotesIcon, iconColor: 'text-orange-500' },
    { label: 'Usage', href: '/settings/usage', Icon: ChartBarIcon, iconColor: 'text-blue-500' },
  ] as const;

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-3">
          {isMainSettings && (
            <>
              {/* Hero: only on main settings page */}
              <div className="bg-white rounded-md p-[10px] flex flex-col items-center text-center">
                <div
                  className={`w-16 h-16 rounded-full flex-shrink-0 mb-2 overflow-hidden ${
                    hasPaidPlanBorder ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600' : 'bg-gray-100'
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-white relative">
                    {account.image_url ? (
                      <Image src={account.image_url} alt={displayName} fill className="object-cover" unoptimized={account.image_url.includes('supabase.co')} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <span className="text-2xl font-medium">{displayName.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <h2 className="text-sm font-semibold text-gray-900 truncate w-full">{displayName}</h2>
                <p className="text-xs text-gray-500 truncate w-full">{subtitle}</p>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <p className="text-xs text-gray-500">{planLabel}</p>
                  {canUpgrade && (
                    <Link
                      href="/settings/plans"
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Upgrade
                    </Link>
                  )}
                </div>
                {userEmail && <p className="text-xs text-gray-500 truncate w-full mt-0.5">{userEmail}</p>}
              </div>

              {/* Admin Nav: Accounts — only on main settings page, admin only */}
              {adminNavItems.length > 0 && (
                <div className="bg-gray-50 rounded-md overflow-hidden">
                  <nav className="flex flex-col" aria-label="Admin settings">
                    {adminNavItems.map((item) => {
                      const Icon = item.Icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center gap-2 px-[10px] py-3 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                        >
                          <Icon className={`w-4 h-4 flex-shrink-0 ${item.iconColor}`} aria-hidden />
                          <span className="flex-1 min-w-0">{item.label}</span>
                          <ChevronRightIcon className="w-4 h-4 flex-shrink-0 text-gray-400" aria-hidden />
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              )}

              {/* Nav: General | Maps — only on main settings page */}
              <div className="bg-gray-50 rounded-md overflow-hidden">
                <nav className="flex flex-col" aria-label="Settings sections">
                  {generalNavItems.map((item) => {
                    const Icon = item.Icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 px-[10px] py-3 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${item.iconColor}`} aria-hidden />
                        <span className="flex-1 min-w-0">{item.label}</span>
                        <ChevronRightIcon className="w-4 h-4 flex-shrink-0 text-gray-400" aria-hidden />
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Account & Privacy Container */}
              <div className="bg-gray-50 rounded-md overflow-hidden">
                <nav className="flex flex-col" aria-label="Account and privacy settings">
                  {accountPrivacyNavItems.map((item) => {
                    const Icon = item.Icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 px-[10px] py-3 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${item.iconColor}`} aria-hidden />
                        <span className="flex-1 min-w-0">{item.label}</span>
                        <ChevronRightIcon className="w-4 h-4 flex-shrink-0 text-gray-400" aria-hidden />
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Billing & Plans Container */}
              <div className="bg-gray-50 rounded-md overflow-hidden">
                <nav className="flex flex-col" aria-label="Billing and plans settings">
                  {billingNavItems.map((item) => {
                    const Icon = item.Icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 px-[10px] py-3 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${item.iconColor}`} aria-hidden />
                        <span className="flex-1 min-w-0">{item.label}</span>
                        <ChevronRightIcon className="w-4 h-4 flex-shrink-0 text-gray-400" aria-hidden />
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Logout Section */}
              <div className="bg-gray-50 rounded-md overflow-hidden">
                {signOutError && (
                  <div className="px-[10px] pt-2 pb-1">
                    <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-xs text-red-600">
                        <span>{signOutError}</span>
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSignOutClick}
                  disabled={isSigningOut}
                  className="w-full flex items-center gap-2 px-[10px] py-3 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSigningOut ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <span className="flex-1 min-w-0">Signing out...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0 text-red-500" aria-hidden />
                      <span className="flex-1 min-w-0">Sign Out</span>
                    </>
                  )}
                </button>
              </div>

              {/* Get in Touch Section */}
              <div className="bg-gray-50 rounded-md p-[10px]">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Get in Touch</h3>
                <p className="text-xs text-gray-600 mb-2">
                  Have an inquiry about love of minnesota?
                </p>
                <a
                  href="mailto:loveofminnesota@gmail.com"
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  loveofminnesota@gmail.com
                </a>
              </div>

              {/* Sign Out Confirmation Modal */}
              {showSignOutConfirm && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="signout-title"
                  onKeyDown={(e) => e.key === 'Escape' && handleSignOutCancel()}
                >
                  <div className="bg-white rounded-md p-[10px] max-w-sm w-full mx-4">
                    <div className="mb-3">
                      <h3 id="signout-title" className="text-sm font-semibold text-gray-900 mb-1.5">
                        Sign out of your account?
                      </h3>
                      <p className="text-xs text-gray-600">
                        You'll need to sign in again to access your account.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSignOutCancel}
                        className="flex-1 px-[10px] py-[10px] text-xs font-medium text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSignOutConfirm}
                        disabled={isSigningOut}
                        className="flex-1 px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSigningOut ? 'Signing out...' : 'Sign out'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Subpage content: only on subpages */}
          {!isMainSettings && <div className="space-y-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPageWrapper({ account, userEmail, mapLimit, children }: SettingsPageWrapperProps) {
  const pathname = usePathname();
  const { openWelcome } = useAppModalContextSafe();

  const subpageTitle = pathname ? SUBPAGE_BACK_TITLES[pathname] : undefined;
  
  // Determine back href: nested subpages go to parent, top-level subpages go to /settings
  let headerBackHref: string | undefined;
  if (subpageTitle) {
    if (pathname === '/settings/maps/pins') {
      headerBackHref = '/settings/maps';
    } else {
      headerBackHref = '/settings';
    }
  }
  
  const headerTitle = subpageTitle;

  return (
    <PageWrapper
      headerContent={null}
      headerBackHref={headerBackHref}
      headerTitle={headerTitle}
      searchComponent={<MapSearchInput onLocationSelect={() => {}} />}
      accountDropdownProps={{
        onAccountClick: () => {},
        onSignInClick: openWelcome,
      }}
      searchResultsComponent={<SearchResults />}
    >
      <SettingsProvider account={account} userEmail={userEmail} mapLimit={mapLimit}>
        <SettingsNavAndContent>{children}</SettingsNavAndContent>
      </SettingsProvider>
    </PageWrapper>
  );
}
