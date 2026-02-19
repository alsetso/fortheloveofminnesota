'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  UserCircleIcon,
  BuildingOfficeIcon,
  NewspaperIcon,
  HeartIcon,
  MapIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import {
  UserCircleIcon as UserCircleIconSolid,
  HeartIcon as HeartIconSolid,
  BuildingOfficeIcon as BuildingOfficeIconSolid,
  NewspaperIcon as NewspaperIconSolid,
  MapIcon as MapIconSolid,
  AcademicCapIcon as AcademicCapIconSolid,
} from '@heroicons/react/24/solid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { AccountService } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { socialGraphQueries } from '@/lib/data/queries/socialGraph';

interface FollowingAccount {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  created_at: string;
}

function FollowingSkeletonCard() {
  return (
    <div className="w-full flex items-center gap-2 px-2 py-2 rounded-md">
      <div className="w-8 h-8 rounded-full bg-surface-accent animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-24 rounded bg-surface-accent animate-pulse" />
          <div className="h-[18px] w-14 rounded bg-surface-accent animate-pulse" />
        </div>
        <div className="h-3 w-16 rounded bg-surface-accent animate-pulse" />
      </div>
    </div>
  );
}

interface LeftSidebarProps {
  children?: ReactNode;
}

/**
 * Left Sidebar - Sticky, scrollable
 * Shows navigation, shortcuts with colorful icons, and footer links
 */
export default function LeftSidebar({ children }: LeftSidebarProps) {
  const pathname = usePathname();
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const queryClient = useQueryClient();

  const { data: edgesData, isLoading: edgesLoading } = useQuery(
    account?.id ? socialGraphQueries.edges(account.id) : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );
  const edges = edgesData?.edges || [];
  const followingEdges = edges.filter(
    (e) => e.from_account_id === account?.id && e.relationship === 'follow' && e.status === 'accepted'
  );
  const followingIds = followingEdges.map((e) => e.to_account_id).slice(0, 10);
  const { data: accountsData, isLoading: accountsLoading } = useQuery(
    followingIds.length > 0 && account?.id
      ? {
          queryKey: ['accounts', 'batch', followingIds.sort().join(',')],
          queryFn: async () => {
            const res = await fetch('/api/accounts/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: followingIds }),
              credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch accounts');
            return res.json();
          },
          enabled: followingIds.length > 0,
          staleTime: 2 * 60 * 1000,
        }
      : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );
  const following: FollowingAccount[] = accountsData?.accounts || [];
  const followingLoading = edgesLoading || accountsLoading;

  useEffect(() => {
    const handleUpdate = () => {
      if (account?.id) {
        queryClient.invalidateQueries({ queryKey: ['social-graph', 'edges', account.id] });
        queryClient.invalidateQueries({ queryKey: ['accounts', 'batch'] });
      }
    };
    window.addEventListener('social-graph-updated', handleUpdate);
    return () => window.removeEventListener('social-graph-updated', handleUpdate);
  }, [account?.id, queryClient]);

  const mainNav = [
    { label: 'Documentation', icon: UserCircleIcon, iconSolid: UserCircleIconSolid, href: '/docs' },
    { label: 'Love of Minnesota', icon: HeartIcon, iconSolid: HeartIconSolid, href: '/' },
    { label: 'Explore', icon: MapIcon, iconSolid: MapIconSolid, href: '/explore' },
    { label: 'Schools', icon: AcademicCapIcon, iconSolid: AcademicCapIconSolid, href: '/schools' },
    { label: 'Government', icon: BuildingOfficeIcon, iconSolid: BuildingOfficeIconSolid, href: '/gov' },
    { label: 'News', icon: NewspaperIcon, iconSolid: NewspaperIconSolid, href: '/news' },
  ];

  const isNavActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Profile Card */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        {account ? (
          <Link
            href={account.username ? `/${encodeURIComponent(account.username)}` : '/settings'}
            className="flex items-center gap-2 p-[10px] rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-accent hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
          >
            <ProfilePhoto account={account} size="sm" editable={false} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">
                {AccountService.getDisplayName(account) || 'Profile'}
              </div>
              {account.username && (
                <div className="text-[10px] text-foreground-muted truncate">@{account.username}</div>
              )}
            </div>
          </Link>
        ) : (
          <button
            type="button"
            onClick={openWelcome}
            className="w-full flex items-center gap-2 p-[10px] rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-accent hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-surface-accent flex items-center justify-center flex-shrink-0">
              <UserCircleIcon className="w-4 h-4 text-foreground-muted" />
            </div>
            <span className="text-xs font-medium text-foreground-muted">Sign in</span>
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="p-3 space-y-1">
        {mainNav.map((item) => {
          const isActive = isNavActive(item.href);
          const Icon = isActive ? item.iconSolid : item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                isActive 
                  ? 'bg-surface-accent text-foreground' 
                  : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Following Section or Custom Content */}
      {children ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {children}
        </div>
      ) : (
      <div className="p-3 border-t border-border-muted dark:border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-foreground">Following</h3>
          {account && (
            <Link
              href="/people"
              className="w-6 h-6 rounded-full hover:bg-surface-accent flex items-center justify-center transition-colors"
              aria-label="Find people"
            >
              <MagnifyingGlassIcon className="w-4 h-4 text-foreground-muted" />
            </Link>
          )}
        </div>
        {!account ? (
          <div className="space-y-3">
            <p className="text-xs text-foreground-muted mb-2">
              See who you follow and discover new people.
            </p>
            <div className="space-y-1">
              <FollowingSkeletonCard />
              <FollowingSkeletonCard />
            </div>
            <button
              type="button"
              onClick={openWelcome}
              className="w-full mt-3 py-2 px-3 text-xs font-medium text-foreground bg-white dark:bg-surface border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-surface-accent rounded-md transition-colors"
            >
              Find friends
            </button>
          </div>
        ) : followingLoading ? (
          <div className="space-y-1">
            <FollowingSkeletonCard />
            <FollowingSkeletonCard />
            <FollowingSkeletonCard />
          </div>
        ) : following.length === 0 ? (
          <div className="text-center py-4">
            <UserPlusIcon className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
            <p className="text-xs text-foreground-muted mb-2">Not following anyone yet</p>
            <Link
              href="/people"
              className="text-xs text-lake-blue hover:text-lake-blue/80 underline"
            >
              Find people to follow
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {following.slice(0, 3).map((acc) => {
              const displayName =
                acc.first_name && acc.last_name
                  ? `${acc.first_name} ${acc.last_name}`
                  : acc.username || 'Unknown User';
              return (
                <Link
                  key={acc.id}
                  href={acc.username ? `/${encodeURIComponent(acc.username)}` : '#'}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-surface-accent transition-colors"
                >
                  <ProfilePhoto account={acc} size="sm" editable={false} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-foreground truncate">{displayName}</span>
                      <span className="text-[10px] text-foreground-muted px-1.5 py-0.5 bg-surface-accent rounded">
                        following
                      </span>
                    </div>
                    {acc.username && (
                      <p className="text-xs text-foreground-muted truncate">@{acc.username}</p>
                    )}
                  </div>
                </Link>
              );
            })}
            {following.length > 3 && (
              <Link
                href="/people"
                className="block w-full mt-1 py-1.5 text-center text-xs text-foreground-muted hover:text-foreground hover:bg-surface-accent rounded-md transition-colors"
              >
                View all ({following.length})
              </Link>
            )}
          </div>
        )}
      </div>
      )}

      {/* Footer Links */}
      <div className="mt-auto px-3 py-3 border-t border-border-muted dark:border-white/10">
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-foreground-subtle">
          <Link href="/privacy" className="hover:underline hover:text-foreground-muted">Privacy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:underline hover:text-foreground-muted">Terms</Link>
          <span>·</span>
          <Link href="/cookies" className="hover:underline hover:text-foreground-muted">Cookies</Link>
        </div>
        <div className="text-xs text-foreground-subtle mt-2">
          Love of Minnesota 2026
        </div>
      </div>
    </div>
  );
}
