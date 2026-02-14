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
  ArrowTopRightOnSquareIcon,
  AtSymbolIcon,
  ServerStackIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { getDisplayName } from '@/types/profile';
import SignOutButton from '@/components/settings/SignOutButton';

/**
 * Left Sidebar for Settings page
 * Navigation menu for all settings sections
 */
export default function SettingsLeftSidebar() {
  const pathname = usePathname();
  const { account, userEmail } = useSettings();
  const isAdmin = account?.role === 'admin';
  
  const displayName = getDisplayName(account);
  const subtitle = account.username ? `@${account.username}` : userEmail || '';
  const profileUrl = account.username ? `/${encodeURIComponent(account.username)}` : null;

  const adminNavItems = isAdmin
    ? [
        { label: 'Accounts', href: '/settings/accounts', Icon: UsersIcon },
        { label: 'Systems', href: '/settings/systems', Icon: ServerStackIcon },
        { label: 'Data Explorer', href: '/settings/data', Icon: CircleStackIcon },
      ]
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
        <SignOutButton />
      </div>
    </div>
  );
}
