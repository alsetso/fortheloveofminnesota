'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { useAuthStateSafe } from '@/features/auth';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { socialGraphQueries } from '@/lib/data/queries/socialGraph';

interface Friend {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  created_at: string;
}

export default function PeopleRightSidebar() {
  const { account } = useAuthStateSafe();
  const queryClient = useQueryClient();

  // Use React Query to fetch edges (cached and shared)
  const { data: edgesData, isLoading: edgesLoading } = useQuery(
    account?.id ? socialGraphQueries.edges(account.id) : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );

  const edges = edgesData?.edges || [];
  
  // Find mutual follows (friends)
  const outgoingFollows = edges.filter(
    (e) => e.from_account_id === account?.id &&
           e.relationship === 'follow' &&
           e.status === 'accepted'
  );
  
  const friendsSet = new Set<string>();
  outgoingFollows.forEach((e) => {
    const reverseEdge = edges.find(
      (rev) => rev.from_account_id === e.to_account_id &&
               rev.to_account_id === account?.id &&
               rev.relationship === 'follow' &&
               rev.status === 'accepted'
    );
    if (reverseEdge) {
      friendsSet.add(e.to_account_id);
    }
  });

  const friendIds = Array.from(friendsSet).slice(0, 10);

  // Batch fetch accounts using React Query
  const { data: accountsData, isLoading: accountsLoading } = useQuery(
    friendIds.length > 0 && account?.id
      ? {
          queryKey: ['accounts', 'batch', friendIds.sort().join(',')],
          queryFn: async () => {
            const res = await fetch('/api/accounts/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: friendIds }),
              credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch accounts');
            return res.json();
          },
          enabled: friendIds.length > 0,
          staleTime: 2 * 60 * 1000, // 2 minutes
        }
      : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );

  const friends: Friend[] = accountsData?.accounts || [];
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-3">
        <div className="w-6 h-6 border-2 border-foreground-muted border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="w-4 h-4 text-foreground-muted" />
          <h3 className="text-sm font-semibold text-foreground">Friends</h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-3 pb-3">
        {friends.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <p className="text-xs text-foreground-muted text-center">
              No friends yet. Follow people and they follow you back to become friends.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => {
              const displayName =
                friend.first_name && friend.last_name
                  ? `${friend.first_name} ${friend.last_name}`
                  : friend.username || 'Unknown User';

              return (
                <Link
                  key={friend.id}
                  href={
                    friend.username
                      ? `/${encodeURIComponent(friend.username)}`
                      : '#'
                  }
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-accent transition-colors"
                >
                  <ProfilePhoto account={friend as unknown as import('@/features/auth').Account} size="sm" editable={false} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {displayName}
                    </h4>
                    {friend.username && (
                      <p className="text-xs text-foreground-muted truncate">
                        @{friend.username}
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
  );
}
