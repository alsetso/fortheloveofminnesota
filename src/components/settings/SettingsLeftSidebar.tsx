'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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
  ArrowTopRightOnSquareIcon,
  AtSymbolIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { useAuth } from '@/features/auth';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDisplayName } from '@/types/profile';

/**
 * Left Sidebar for Settings page
 * Navigation menu for all settings sections
 */
export default function SettingsLeftSidebar() {
  const pathname = usePathname();
  const { account, userEmail } = useSettings();
  const { signOut } = useAuth();
  const router = useRouter();
  const isAdmin = account?.role === 'admin';
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  
  const displayName = getDisplayName(account);
  const subtitle = account.username ? `@${account.username}` : userEmail || '';
  const profileUrl = account.username ? `/${encodeURIComponent(account.username)}` : null;

  const handleSignOutClick = () => setShowSignOutConfirm(true);

  const handleSignOutConfirm = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };

  const adminNavItems = isAdmin
    ? [{ label: 'Accounts', href: '/settings/accounts', Icon: UsersIcon }]
    : [];

  const generalNavItems = [
    { label: 'General', href: '/settings/general', Icon: Cog6ToothIcon },
    { label: 'Maps', href: '/settings/maps', Icon: MapIcon },
    { label: 'Pins', href: '/settings/pins', Icon: MapPinIcon },
    { label: 'Collections', href: '/settings/collections', Icon: Square3Stack3DIcon },
    { label: 'Business', href: '/settings/business', Icon: BuildingOfficeIcon },
  ] as const;

  const accountPrivacyNavItems = [
    { label: 'Privacy', href: '/settings/privacy', Icon: ShieldCheckIcon },
    { label: 'Account', href: '/settings/account', Icon: UserCircleIcon },
    { label: 'Username', href: '/settings/username', Icon: AtSymbolIcon },
    { label: 'History', href: '/settings/history', Icon: ClockIcon },
    { label: 'ID Verification', href: '/settings/id', Icon: IdentificationIcon },
  ] as const;

  const billingNavItems = [
    { label: 'Plans', href: '/settings/plans', Icon: CreditCardIcon },
    { label: 'Billing', href: '/settings/billing', Icon: BanknotesIcon },
    { label: 'Usage', href: '/settings/usage', Icon: ChartBarIcon },
  ] as const;

  const isActive = (href: string) => pathname === href || (href !== '/settings' && pathname?.startsWith(href));

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <h2 className="text-base font-semibold text-foreground">Settings</h2>
      </div>

      {/* Profile Card */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-accent flex-shrink-0">
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={displayName}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                  unoptimized={account.image_url.includes('supabase.co')}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-foreground-muted">
                  <span className="text-lg font-medium">{displayName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{displayName}</h3>
              <p className="text-xs text-foreground-muted truncate">{subtitle}</p>
            </div>
          </div>
          {profileUrl && (
            <Link
              href={profileUrl}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 dark:hover:bg-white/10 transition-colors"
            >
              <span>View Profile</span>
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Admin Section */}
      {adminNavItems.length > 0 && (
        <div className="p-3 border-b border-border-muted dark:border-white/10">
          <div className="space-y-1">
            {adminNavItems.map((item) => {
              const Icon = item.Icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                    isActive(item.href)
                      ? 'bg-surface-accent text-foreground'
                      : 'text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRightIcon className="w-4 h-4 text-foreground-muted" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* General Section */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <div className="space-y-1">
          {generalNavItems.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-surface-accent text-foreground'
                    : 'text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                <ChevronRightIcon className="w-4 h-4 text-foreground-muted" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Account & Privacy Section */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <div className="space-y-1">
          {accountPrivacyNavItems.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-surface-accent text-foreground'
                    : 'text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                <ChevronRightIcon className="w-4 h-4 text-foreground-muted" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Billing Section */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <div className="space-y-1">
          {billingNavItems.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-surface-accent text-foreground'
                    : 'text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                <ChevronRightIcon className="w-4 h-4 text-foreground-muted" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Sign Out */}
      <div className="mt-auto p-3 border-t border-border-muted dark:border-white/10">
        <button
          onClick={handleSignOutClick}
          disabled={isSigningOut}
          className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-400" />
          <span className="flex-1 text-left">{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setShowSignOutConfirm(false)}
        >
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-4 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Sign out of your account?</h3>
            <p className="text-xs text-foreground-muted mb-4">
              You'll need to sign in again to access your account.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 px-3 py-2 text-xs font-medium text-foreground-muted bg-surface-accent rounded-md hover:bg-surface-accent/80 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOutConfirm}
                disabled={isSigningOut}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
