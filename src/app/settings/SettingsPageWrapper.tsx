'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import SettingsLeftSidebar from '@/components/settings/SettingsLeftSidebar';
import { SettingsProvider, useSettings } from '@/features/settings/contexts/SettingsContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName } from '@/types/profile';
import SignOutButton from '@/components/settings/SignOutButton';
import {
  Cog6ToothIcon,
  MapIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  CreditCardIcon,
  BanknotesIcon,
  MapPinIcon,
  ClockIcon,
  Square3Stack3DIcon,
  BuildingOfficeIcon,
  UsersIcon,
  IdentificationIcon,
  ChartBarIcon,
  AtSymbolIcon,
  ArrowTopRightOnSquareIcon,
  CircleStackIcon,
  ServerStackIcon,
  ChevronLeftIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

interface SettingsPageWrapperProps {
  account: ProfileAccount;
  userEmail: string;
  mapLimit: number;
  children: React.ReactNode;
}

export default function SettingsPageWrapper({ account, userEmail, mapLimit, children }: SettingsPageWrapperProps) {
  const pathname = usePathname();
  const isMainSettings = pathname === '/settings';
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <SettingsProvider account={account} userEmail={userEmail} mapLimit={mapLimit}>
      <NewPageWrapper
        leftSidebar={
          sidebarVisible
            ? isMainSettings
              ? <SettingsHomeSidebar onHideSidebar={() => setSidebarVisible(false)} />
              : <SettingsLeftSidebar onHideSidebar={() => setSidebarVisible(false)} />
            : undefined
        }
      >
        <div className="max-w-2xl mx-auto w-full px-4 py-6">
          {!sidebarVisible && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setSidebarVisible(true)}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5 rotate-180" />
                <span>Show sidebar</span>
              </button>
            </div>
          )}
          {isMainSettings ? (
            <SettingsOverview />
          ) : (
            <>
              <div className="mb-3 lg:hidden">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
                >
                  <ChevronLeftIcon className="w-3.5 h-3.5" />
                  <span>Settings</span>
                </Link>
              </div>
              <div className="space-y-3">{children}</div>
            </>
          )}
        </div>
      </NewPageWrapper>
    </SettingsProvider>
  );
}

/* ─────────────────────────────────────────────────
   Left sidebar for /settings main page only
   Profile, plan, stats summary, sign out
   ───────────────────────────────────────────────── */

const PLAN_LABELS: Record<string, string> = {
  hobby: 'Hobby',
  contributor: 'Contributor',
  plus: 'Pro+',
  business: 'Business',
  gov: 'Government',
};

function SettingsHomeSidebar({ onHideSidebar }: { onHideSidebar?: () => void }) {
  const { account, userEmail, mapLimit } = useSettings();
  const supabase = useSupabaseClient();
  const displayName = getDisplayName(account);
  const planLabel = (account.plan && PLAN_LABELS[account.plan]) || 'Hobby';
  const profileUrl = account.username ? `/${encodeURIComponent(account.username)}` : null;
  const canUpgrade = !account.plan || account.plan === 'hobby' || account.plan === 'contributor';

  const [stats, setStats] = useState({ pins: 0, collections: 0, maps: 0, visits: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      if (!account?.id) return;
      try {
        const [pinsRes, collectionsRes, mapsRes, visitsRes] = await Promise.all([
          supabase.from('map_pins').select('id', { count: 'exact', head: true }).eq('account_id', account.id).eq('is_active', true),
          supabase.from('collections').select('id', { count: 'exact', head: true }).eq('account_id', account.id),
          fetch(`/api/maps?account_id=${account.id}&limit=1&offset=0`).then((r) => r.json()).catch(() => ({ maps: [] })),
          supabase.from('url_visits').select('id', { count: 'exact', head: true }).eq('account_id', account.id),
        ]);
        setStats({
          pins: pinsRes.count ?? 0,
          collections: collectionsRes.count ?? 0,
          maps: Array.isArray(mapsRes.maps) ? mapsRes.maps.length : (mapsRes.total ?? 0),
          visits: visitsRes.count ?? 0,
        });
      } catch {
        // Silently fail, stats show 0
      } finally {
        setStatsLoaded(true);
      }
    }
    fetchStats();
  }, [account?.id, supabase]);

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header with hide */}
      {onHideSidebar && (
        <div className="p-3 border-b border-border-muted dark:border-white/10 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Settings</span>
          <button
            type="button"
            onClick={onHideSidebar}
            className="flex items-center justify-center w-7 h-7 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-accent transition-colors"
            title="Hide sidebar"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Profile */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-accent flex-shrink-0">
            {account.image_url ? (
              <Image
                src={account.image_url}
                alt={displayName}
                width={40}
                height={40}
                className="object-cover w-full h-full"
                unoptimized={account.image_url?.includes('supabase.co')}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-foreground-muted">
                <span className="text-sm font-medium">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-foreground-muted truncate">
              {account.username ? `@${account.username}` : userEmail}
            </p>
          </div>
        </div>
        {profileUrl && (
          <Link
            href={profileUrl}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 dark:hover:bg-white/10 transition-colors"
          >
            View Profile
            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Plan */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-foreground-muted uppercase tracking-wider">Plan</p>
            <p className="text-xs font-semibold text-foreground">{planLabel}</p>
          </div>
          {canUpgrade && (
            <Link
              href="/settings/plans"
              className="px-2.5 py-1 text-[10px] font-medium text-white bg-lake-blue rounded-md hover:bg-lake-blue/90 transition-colors"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <p className="text-[10px] text-foreground-muted uppercase tracking-wider mb-2">Your Data</p>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Pins" value={stats.pins} loaded={statsLoaded} href="/settings/pins" />
          <StatCard label="Collections" value={stats.collections} loaded={statsLoaded} href="/settings/collections" />
          <StatCard label="Maps" value={stats.maps} loaded={statsLoaded} href="/settings/maps" />
          <StatCard label="Visits" value={stats.visits} loaded={statsLoaded} href="/settings/history" />
        </div>
      </div>

      {/* Quick Links */}
      <div className="p-3 border-b border-border-muted dark:border-white/10 space-y-0.5">
        <SidebarLink href="/settings/billing" label="Billing" />
        <SidebarLink href="/settings/privacy" label="Privacy" />
        <SidebarLink href="/settings/account" label="Account" />
      </div>

      {/* Map Limit */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-foreground-muted">Map limit</p>
          <p className="text-xs font-medium text-foreground tabular-nums">
            {stats.maps} / {mapLimit === -1 ? '∞' : mapLimit}
          </p>
        </div>
        {mapLimit > 0 && (
          <div className="mt-1.5 h-1 bg-surface-accent rounded-full overflow-hidden">
            <div
              className="h-full bg-lake-blue rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (stats.maps / mapLimit) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Contact */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <p className="text-[10px] text-foreground-muted mb-1">Need help?</p>
        <a
          href="mailto:loveofminnesota@gmail.com"
          className="text-xs text-lake-blue hover:text-lake-blue/80 hover:underline"
        >
          loveofminnesota@gmail.com
        </a>
      </div>

      {/* Sign Out */}
      <div className="p-3">
        <SignOutButton />
      </div>
    </div>
  );
}

function StatCard({ label, value, loaded, href }: { label: string; value: number; loaded: boolean; href: string }) {
  return (
    <Link
      href={href}
      className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-2 hover:bg-surface-accent/50 dark:hover:bg-white/5 transition-colors text-center"
    >
      {loaded ? (
        <p className="text-sm font-semibold text-foreground tabular-nums">{value.toLocaleString()}</p>
      ) : (
        <div className="h-5 w-8 mx-auto bg-surface-accent rounded animate-pulse" />
      )}
      <p className="text-[10px] text-foreground-muted mt-0.5">{label}</p>
    </Link>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-2 py-1.5 text-xs text-foreground-muted hover:text-foreground hover:bg-surface-accent dark:hover:bg-white/10 rounded-md transition-colors"
    >
      {label}
    </Link>
  );
}

/* ─────────────────────────────────────────────────
   Settings Overview — main content at /settings
   Stats row + nav grid
   ───────────────────────────────────────────────── */

function SettingsOverview() {
  const { account, userEmail, mapLimit } = useSettings();
  const supabase = useSupabaseClient();
  const displayName = getDisplayName(account);
  const isAdmin = account?.role === 'admin';
  const planLabel = (account.plan && PLAN_LABELS[account.plan]) || 'Hobby';
  const profileUrl = account.username ? `/${encodeURIComponent(account.username)}` : null;

  const [stats, setStats] = useState({ pins: 0, collections: 0, maps: 0, visits: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      if (!account?.id) return;
      try {
        const [pinsRes, collectionsRes, mapsRes, visitsRes] = await Promise.all([
          supabase.from('map_pins').select('id', { count: 'exact', head: true }).eq('account_id', account.id).eq('is_active', true),
          supabase.from('collections').select('id', { count: 'exact', head: true }).eq('account_id', account.id),
          fetch(`/api/maps?account_id=${account.id}&limit=1&offset=0`).then((r) => r.json()).catch(() => ({ maps: [] })),
          supabase.from('url_visits').select('id', { count: 'exact', head: true }).eq('account_id', account.id),
        ]);
        setStats({
          pins: pinsRes.count ?? 0,
          collections: collectionsRes.count ?? 0,
          maps: Array.isArray(mapsRes.maps) ? mapsRes.maps.length : (mapsRes.total ?? 0),
          visits: visitsRes.count ?? 0,
        });
      } catch {
        // Silently fail
      } finally {
        setStatsLoaded(true);
      }
    }
    fetchStats();
  }, [account?.id, supabase]);

  return (
    <div className="space-y-4">
      {/* Account Card */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-accent flex-shrink-0">
            {account.image_url ? (
              <Image
                src={account.image_url}
                alt={displayName}
                width={48}
                height={48}
                className="object-cover w-full h-full"
                unoptimized={account.image_url?.includes('supabase.co')}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-foreground-muted">
                <span className="text-lg font-medium">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">{displayName}</h2>
            <p className="text-xs text-foreground-muted truncate">
              {account.username ? `@${account.username}` : userEmail}
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">{planLabel}</p>
          </div>
          {profileUrl && (
            <Link
              href={profileUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 dark:hover:bg-white/10 transition-colors flex-shrink-0"
            >
              Profile
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <OverviewStat label="Pins" value={stats.pins} loaded={statsLoaded} href="/settings/pins" icon={MapPinIcon} />
        <OverviewStat label="Collections" value={stats.collections} loaded={statsLoaded} href="/settings/collections" icon={Square3Stack3DIcon} />
        <OverviewStat label="Maps" value={stats.maps} loaded={statsLoaded} href="/settings/maps" icon={MapIcon} subtext={mapLimit > 0 ? `/ ${mapLimit} limit` : undefined} />
        <OverviewStat label="Visits" value={stats.visits} loaded={statsLoaded} href="/settings/history" icon={ClockIcon} />
      </div>

      {/* Plan & Billing Quick View */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CreditCardIcon className="w-4 h-4 text-foreground-muted" />
            <div>
              <p className="text-xs font-medium text-foreground">{planLabel} Plan</p>
              <p className="text-[10px] text-foreground-muted">
                {account.subscription_status === 'active' ? 'Active subscription' :
                 account.subscription_status === 'trialing' ? 'Trial period' :
                 'No active subscription'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/settings/usage"
              className="px-2.5 py-1 text-[10px] font-medium text-foreground-muted bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors"
            >
              Usage
            </Link>
            <Link
              href="/settings/plans"
              className="px-2.5 py-1 text-[10px] font-medium text-white bg-lake-blue rounded-md hover:bg-lake-blue/90 transition-colors"
            >
              Plans
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Grid */}
      <SettingsNavSection title="General" items={GENERAL_NAV} />
      <SettingsNavSection title="Account & Privacy" items={ACCOUNT_NAV} />
      <SettingsNavSection title="Billing" items={BILLING_NAV} />

      {/* Admin-only */}
      {isAdmin && (
        <SettingsNavSection title="Admin" items={ADMIN_NAV} />
      )}
    </div>
  );
}

/* ─── Stat Card for Overview ─── */

function OverviewStat({
  label,
  value,
  loaded,
  href,
  icon: Icon,
  subtext,
}: {
  label: string;
  value: number;
  loaded: boolean;
  href: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;
  subtext?: string;
}) {
  return (
    <Link
      href={href}
      className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3 hover:bg-surface-accent/50 dark:hover:bg-white/5 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-foreground-muted group-hover:text-foreground transition-colors" />
        <span className="text-[10px] text-foreground-muted">{label}</span>
      </div>
      {loaded ? (
        <p className="text-lg font-semibold text-foreground tabular-nums">{value.toLocaleString()}</p>
      ) : (
        <div className="h-6 w-10 bg-surface-accent rounded animate-pulse" />
      )}
      {subtext && <p className="text-[10px] text-foreground-muted mt-0.5">{subtext}</p>}
    </Link>
  );
}

/* ─── Nav Section Component ─── */

interface NavItem {
  label: string;
  href: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;
  description: string;
}

function SettingsNavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2 px-1">
        {title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col gap-1.5 p-3 bg-surface border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/50 dark:hover:bg-white/5 transition-colors group"
            >
              <Icon className="w-4 h-4 text-foreground-muted group-hover:text-foreground transition-colors" />
              <span className="text-xs font-medium text-foreground">{item.label}</span>
              <span className="text-[10px] text-foreground-muted leading-tight">{item.description}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Nav Item Definitions ─── */

const GENERAL_NAV: NavItem[] = [
  { label: 'General', href: '/settings/general', icon: Cog6ToothIcon, description: 'Profile, verification, location' },
  { label: 'Maps', href: '/settings/maps', icon: MapIcon, description: 'Your maps and limits' },
  { label: 'Pins', href: '/settings/pins', icon: MapPinIcon, description: 'Manage saved pins' },
  { label: 'Collections', href: '/settings/collections', icon: Square3Stack3DIcon, description: 'Organize pins into groups' },
  { label: 'Business', href: '/settings/business', icon: BuildingOfficeIcon, description: 'Business plan setup' },
];

const ACCOUNT_NAV: NavItem[] = [
  { label: 'Privacy', href: '/settings/privacy', icon: ShieldCheckIcon, description: 'Visibility and tagging' },
  { label: 'Account', href: '/settings/account', icon: UserCircleIcon, description: 'Profile details' },
  { label: 'Username', href: '/settings/username', icon: AtSymbolIcon, description: 'Change your @handle' },
  { label: 'History', href: '/settings/history', icon: ClockIcon, description: 'Activity and visits' },
  { label: 'ID Verification', href: '/settings/id', icon: IdentificationIcon, description: 'Verify your identity' },
];

const BILLING_NAV: NavItem[] = [
  { label: 'Plans', href: '/settings/plans', icon: CreditCardIcon, description: 'Compare and upgrade' },
  { label: 'Billing', href: '/settings/billing', icon: BanknotesIcon, description: 'Payment and subscription' },
  { label: 'Usage', href: '/settings/usage', icon: ChartBarIcon, description: 'Limits and features' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Accounts', href: '/settings/admin/accounts', icon: UsersIcon, description: 'Manage all accounts' },
  { label: 'Systems', href: '/settings/admin/systems', icon: ServerStackIcon, description: 'Database tables and system' },
  { label: 'Data Explorer', href: '/settings/admin/data', icon: CircleStackIcon, description: 'Browse all public tables' },
  { label: 'Pricing', href: '/settings/admin/pricing', icon: CurrencyDollarIcon, description: 'Plan features and limits' },
];
