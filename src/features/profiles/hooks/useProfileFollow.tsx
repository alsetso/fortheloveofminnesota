'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { useState, useMemo, useCallback } from 'react';
import { socialGraphQueries } from '@/lib/data/queries/socialGraph';

/**
 * Returns a follow/unfollow button slot for the profile card.
 * Use when the same follow state must be shared (e.g. sidebar + mobile sheet).
 */
export function useProfileFollow(accountId: string, isOwnProfile: boolean, viewerAccountId: string | undefined) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [followLoading, setFollowLoading] = useState(false);

  const { data: edgesData } = useQuery(
    viewerAccountId && !isOwnProfile
      ? socialGraphQueries.edges(viewerAccountId)
      : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );
  const edges = edgesData?.edges ?? [];
  const followEdge = edges.find(
    (e) => e.to_account_id === accountId && e.relationship === 'follow' && e.status === 'accepted'
  );
  const isFollowing = !!followEdge;

  const handleFollow = useCallback(async () => {
    if (!viewerAccountId || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch('/api/social/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_account_id: accountId, relationship: 'follow' }),
        credentials: 'include',
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['social-graph', 'edges', viewerAccountId] });
        router.refresh();
      }
    } finally {
      setFollowLoading(false);
    }
  }, [accountId, viewerAccountId, queryClient, router]);

  const handleUnfollow = useCallback(async () => {
    if (!followEdge?.id || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/social/edges?edge_id=${encodeURIComponent(followEdge.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['social-graph', 'edges', viewerAccountId] });
        router.refresh();
      }
    } finally {
      setFollowLoading(false);
    }
  }, [followEdge?.id, queryClient, router, viewerAccountId]);

  const followSlot = useMemo(() => {
    if (isOwnProfile || !viewerAccountId) return null;
    if (isFollowing) {
      return (
        <button
          type="button"
          onClick={handleUnfollow}
          disabled={followLoading}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md border border-border-muted dark:border-white/10 bg-surface-accent dark:bg-white/10 text-foreground hover:bg-surface-accent/80 dark:hover:bg-white/20 transition-colors disabled:opacity-60"
        >
          <UserPlusIcon className="w-3.5 h-3.5" />
          Following
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleFollow}
        disabled={followLoading}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-lake-blue text-white hover:bg-lake-blue/90 transition-colors disabled:opacity-60"
      >
        <UserPlusIcon className="w-3.5 h-3.5" />
        Follow
      </button>
    );
  }, [isOwnProfile, viewerAccountId, isFollowing, followLoading, handleFollow, handleUnfollow]);

  return { followSlot };
}
