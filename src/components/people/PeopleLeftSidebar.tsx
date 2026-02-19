'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStateSafe } from '@/features/auth';
import { UserPlusIcon, UsersIcon } from '@heroicons/react/24/outline';
import { UserPlusIcon as UserPlusIconSolid, UsersIcon as UsersIconSolid } from '@heroicons/react/24/solid';
import { useSearchParams } from 'next/navigation';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { socialGraphQueries } from '@/lib/data/queries/socialGraph';

export default function PeopleLeftSidebar() {
  const { account } = useAuthStateSafe();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Use React Query to fetch edges (cached and shared)
  const { data: edgesData, isLoading: loading } = useQuery(
    account?.id ? socialGraphQueries.edges(account.id) : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );

  // Listen for social graph updates and invalidate cache
  useEffect(() => {
    const handleUpdate = () => {
      if (account?.id) {
        queryClient.invalidateQueries({ queryKey: ['social-graph', 'edges', account.id] });
      }
    };

    window.addEventListener('social-graph-updated', handleUpdate);
    return () => {
      window.removeEventListener('social-graph-updated', handleUpdate);
    };
  }, [account?.id, queryClient]);

  // Calculate stats from edges
  const edges = edgesData?.edges || [];
  
  // Count following (outgoing follow edges)
  const following = edges.filter(
    (e) => e.from_account_id === account?.id && 
           e.relationship === 'follow' && 
           e.status === 'accepted'
  ).length;

  // Count followers (incoming follow edges)
  const followers = edges.filter(
    (e) => e.to_account_id === account?.id && 
           e.relationship === 'follow' && 
           e.status === 'accepted'
  ).length;

  const navItems: Array<{
    label: string;
    href: string;
    icon: typeof UserPlusIcon;
    iconSolid: typeof UserPlusIconSolid;
    count: number;
    badge?: string | number;
  }> = [
    {
      label: 'Following',
      href: '/people?tab=following',
      icon: UserPlusIcon,
      iconSolid: UserPlusIconSolid,
      count: following,
    },
    {
      label: 'Followers',
      href: '/people?tab=followers',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      count: followers,
    },
  ];

  const currentTab = searchParams.get('tab');
  
  const isActive = (href: string) => {
    const url = new URL(href, 'http://localhost');
    const tab = url.searchParams.get('tab');
    return tab === currentTab || (!currentTab && tab === null);
  };

  const displayName = account?.first_name && account?.last_name
    ? `${account.first_name} ${account.last_name}`
    : account?.username || 'User';

  const profileUrl = account?.username ? `/${encodeURIComponent(account.username)}` : '#';

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* User Profile */}
      {account && (
        <div className="p-3 border-b border-border-muted dark:border-white/10">
          <Link
            href={profileUrl}
            className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-accent transition-colors"
          >
            <ProfilePhoto account={account} size="md" editable={false} />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {displayName}
              </h3>
              {account.username && (
                <p className="text-xs text-foreground-muted truncate">
                  @{account.username}
                </p>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <div className="p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = isActive(item.href) ? item.iconSolid : item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center justify-between px-2 py-2 text-sm rounded-md transition-colors ${
                active
                  ? 'bg-surface-accent text-foreground'
                  : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-lake-blue text-white rounded-full min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
                {!loading && (
                  <span className={`text-xs ${active ? 'text-foreground-muted' : 'text-foreground-subtle'}`}>
                    {item.count}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Stats Summary */}
      {!loading && (
        <div className="px-3 py-3 border-t border-border-muted dark:border-white/10 mt-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground-muted">Total Connections</span>
              <span className="text-foreground font-medium">
                {following + followers}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
