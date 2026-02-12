'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { useAuthStateSafe } from '@/features/auth';
import { socialGraphQueries } from '@/lib/data/queries/socialGraph';

interface RightSidebarProps {
  children?: ReactNode;
}

interface FollowingAccount {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  created_at: string;
}

/**
 * Right Sidebar - Sticky, scrollable
 * Shows ad widget and following list (social edges)
 */
export default function RightSidebar({ children }: RightSidebarProps) {
  const { account } = useAuthStateSafe();
  const queryClient = useQueryClient();

  // Fetch social edges for current account
  const { data: edgesData, isLoading: edgesLoading } = useQuery(
    account?.id ? socialGraphQueries.edges(account.id) : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );

  const edges = edgesData?.edges || [];
  
  // Get accounts the current user is following (outgoing follow edges)
  const followingEdges = edges.filter(
    (e) => e.from_account_id === account?.id &&
           e.relationship === 'follow' &&
           e.status === 'accepted'
  );
  
  const followingIds = followingEdges.map(e => e.to_account_id).slice(0, 10);

  // Batch fetch accounts using React Query
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
          staleTime: 2 * 60 * 1000, // 2 minutes
        }
      : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );

  const following: FollowingAccount[] = accountsData?.accounts || [];
  const loading = edgesLoading || accountsLoading;

  // Listen for social graph updates and invalidate cache
  useEffect(() => {
    const handleUpdate = () => {
      if (account?.id) {
        queryClient.invalidateQueries({ queryKey: ['social-graph', 'edges', account.id] });
        queryClient.invalidateQueries({ queryKey: ['accounts', 'batch'] });
      }
    };

    window.addEventListener('social-graph-updated', handleUpdate);
    return () => {
      window.removeEventListener('social-graph-updated', handleUpdate);
    };
  }, [account?.id, queryClient]);

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto scrollbar-hide">
      {children || (
        <div className="space-y-4">
          {/* Following Section */}
          <div>
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
              <div className="text-center py-4">
                <p className="text-xs text-foreground-muted mb-2">Sign in to see who you're following</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-foreground-muted border-t-transparent rounded-full animate-spin" />
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
                {following.map((account) => {
                  const displayName =
                    account.first_name && account.last_name
                      ? `${account.first_name} ${account.last_name}`
                      : account.username || 'Unknown User';

                  return (
                    <Link
                      key={account.id}
                      href={
                        account.username
                          ? `/${encodeURIComponent(account.username)}`
                          : '#'
                      }
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-surface-accent transition-colors"
                    >
                      <ProfilePhoto account={account} size="sm" editable={false} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-foreground truncate">{displayName}</span>
                          <span className="text-[10px] text-foreground-muted px-1.5 py-0.5 bg-surface-accent rounded">
                            following
                          </span>
                        </div>
                        {account.username && (
                          <p className="text-xs text-foreground-muted truncate">
                            @{account.username}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
