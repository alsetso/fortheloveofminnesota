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
} from '@heroicons/react/24/outline';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { SettingsProvider, useSettings } from '@/features/settings/contexts/SettingsContext';
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
  '/settings/general': 'General',
  '/settings/maps': 'Maps',
  '/settings/privacy': 'Privacy',
  '/settings/account': 'Account',
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
  const { account, userEmail } = useSettings();
  const isMainSettings = pathname === '/settings';

  const displayName = getDisplayName(account);
  const subtitle = account.username ? `@${account.username}` : userEmail || '';
  const planLabel = (account.plan && PLAN_LABELS[account.plan]) || 'Hobby';
  const hasPaidPlanBorder = account.plan === 'contributor' || account.plan === 'plus';

  const navItems = [
    { label: 'General', href: '/settings/general', Icon: Cog6ToothIcon, iconColor: 'text-gray-500' },
    { label: 'Maps', href: '/settings/maps', Icon: MapIcon, iconColor: 'text-blue-500' },
    { label: 'Privacy', href: '/settings/privacy', Icon: ShieldCheckIcon, iconColor: 'text-green-500' },
    { label: 'Account', href: '/settings/account', Icon: UserCircleIcon, iconColor: 'text-gray-600' },
  ] as const;

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-3">
          {isMainSettings && (
            <>
              {/* Hero: only on main settings page */}
              <div className="bg-white border border-gray-200 rounded-md p-[10px] flex flex-col items-center text-center">
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
                <p className="text-xs text-gray-500 truncate w-full mt-0.5">{planLabel}</p>
                {userEmail && <p className="text-xs text-gray-500 truncate w-full mt-0.5">{userEmail}</p>}
              </div>

              {/* Nav: General | Maps | Privacy | Account — only on main settings page */}
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <nav className="flex flex-col" aria-label="Settings sections">
                  {navItems.map((item) => {
                    const Icon = item.Icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 px-[10px] py-3 text-xs font-medium border-b border-gray-200 last:border-b-0 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${item.iconColor}`} aria-hidden />
                        <span className="flex-1 min-w-0">{item.label}</span>
                        <ChevronRightIcon className="w-4 h-4 flex-shrink-0 text-gray-400" aria-hidden />
                      </Link>
                    );
                  })}
                </nav>
              </div>
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
  const headerBackHref = subpageTitle ? '/settings' : undefined;
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
