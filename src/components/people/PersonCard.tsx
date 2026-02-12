'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { useAuthStateSafe } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { UserPlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';

interface Person {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  bio: string | null;
  created_at: string;
  plan: string | null;
  traits: string[] | null;
}

interface Edge {
  id: string;
  from_account_id: string;
  to_account_id: string;
  relationship: 'follow' | 'block';
  status: 'pending' | 'accepted';
  created_at: string;
}

interface PersonCardProps {
  person: Person;
  edges?: Edge[]; // Optional: if provided, use these instead of fetching
}

export default function PersonCard({ person, edges: providedEdges }: PersonCardProps) {
  const { account } = useAuthStateSafe();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [relationship, setRelationship] = useState<Edge | null>(null);
  const [isMutualFollow, setIsMutualFollow] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Use provided edges or fetch if not provided (backward compatibility)
  useEffect(() => {
    if (!account || !person.id) return;

    const calculateRelationship = (edges: Edge[]) => {
      // Find edge where current user is source and person is target
      const outgoingEdge = edges.find(
        (e: Edge) =>
          e.from_account_id === account.id &&
          e.to_account_id === person.id &&
          e.relationship === 'follow'
      );
      
      // Find edge where person is source and current user is target (reverse follow)
      const incomingEdge = edges.find(
        (e: Edge) =>
          e.from_account_id === person.id &&
          e.to_account_id === account.id &&
          e.relationship === 'follow'
      );

      // Check if both edges exist and are accepted (mutual follow = friends)
      const mutual = !!outgoingEdge && !!incomingEdge && 
                    outgoingEdge.status === 'accepted' && 
                    incomingEdge.status === 'accepted';
      
      setIsMutualFollow(mutual);
      setRelationship(outgoingEdge || null);
    };

    if (providedEdges) {
      // Use provided edges (no fetch needed)
      calculateRelationship(providedEdges);
    } else {
      // Fallback: fetch edges (for backward compatibility)
      const fetchRelationship = async () => {
        try {
          const response = await fetch(`/api/social/edges/${account.id}`);
          const data = await response.json();

          if (response.ok && data.edges) {
            calculateRelationship(data.edges);
          }
        } catch (error) {
          console.error('Error fetching relationship:', error);
        }
      };

      fetchRelationship();
    }
  }, [account?.id, person.id, providedEdges]);

  const handleAction = async (action: 'follow' | 'unfollow') => {
    if (!account || actionLoading) return;

    setActionLoading(true);
    const displayName = person.first_name && person.last_name
      ? `${person.first_name} ${person.last_name}`
      : person.username || 'User';

    try {
      if (action === 'unfollow') {
        // Delete edge
        const response = await fetch(
          `/api/social/edges?edge_id=${relationship?.id}`,
          { method: 'DELETE' }
        );

        if (response.ok) {
          setRelationship(null);
          setIsMutualFollow(false);
          toast.success('Unfollowed', `You are no longer following ${displayName}`);
          // Invalidate React Query cache
          if (account?.id) {
            queryClient.invalidateQueries({ queryKey: ['social-graph', 'edges', account.id] });
            queryClient.invalidateQueries({ queryKey: ['accounts', 'batch'] });
          }
          // Trigger a custom event to refresh sidebar stats
          window.dispatchEvent(new CustomEvent('social-graph-updated'));
        } else {
          const data = await response.json();
          toast.error('Error', data.error || 'Failed to unfollow');
        }
      } else {
        // Create new follow edge
        const response = await fetch('/api/social/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_account_id: person.id,
            relationship: 'follow',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setRelationship(data.edge);
          setIsMutualFollow(data.isMutualFollow || false);
          
          if (data.isMutualFollow) {
            toast.success('Friends!', `You and ${displayName} are now friends`);
          } else {
            toast.success('Following', `You are now following ${displayName}`);
          }
          
          // Invalidate React Query cache - will trigger refetch and update all components
          if (account?.id) {
            queryClient.invalidateQueries({ queryKey: ['social-graph', 'edges', account.id] });
            queryClient.invalidateQueries({ queryKey: ['accounts', 'batch'] });
          }
          // Trigger a custom event to refresh sidebar stats
          window.dispatchEvent(new CustomEvent('social-graph-updated'));
        } else {
          const data = await response.json();
          toast.error('Error', data.error || 'Failed to follow');
        }
      }
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Error', error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const displayName =
    person.first_name && person.last_name
      ? `${person.first_name} ${person.last_name}`
      : person.username || 'Unknown User';

  const profileUrl = person.username ? `/${encodeURIComponent(person.username)}` : '#';

  return (
    <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-4 hover:bg-surface-accent transition-colors">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Link href={profileUrl} className="flex-shrink-0">
          <ProfilePhoto account={person} size="md" editable={false} />
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Link href={profileUrl}>
                <h3 className="text-sm font-semibold text-foreground hover:underline truncate">
                  {displayName}
                </h3>
              </Link>
              {person.username && (
                <p className="text-xs text-foreground-muted truncate">
                  @{person.username}
                </p>
              )}
              {person.bio && (
                <p className="text-xs text-foreground-muted mt-1 line-clamp-2">
                  {person.bio}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {relationship ? (
                isMutualFollow ? (
                  // Mutual follow = Friends
                  <button
                    onClick={() => handleAction('unfollow')}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
                  >
                    <CheckIconSolid className="w-4 h-4" />
                    Friends
                  </button>
                ) : relationship.relationship === 'follow' ? (
                  // Following (one-way)
                  <button
                    onClick={() => handleAction('unfollow')}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface-accent text-foreground rounded-md hover:bg-surface-accent/80 transition-colors"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Following
                  </button>
                ) : (
                  // Blocked
                  <span className="text-xs text-foreground-muted px-2 py-1">
                    Blocked
                  </span>
                )
              ) : (
                // No relationship - show follow button
                <button
                  onClick={() => handleAction('follow')}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors disabled:opacity-50"
                >
                  <UserPlusIcon className="w-4 h-4" />
                  Follow
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
