'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStateSafe } from '@/features/auth';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import PersonCard from './PersonCard';
import { socialGraphQueries, Edge } from '@/lib/data/queries/socialGraph';

interface Account {
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

interface PeopleTabContentProps {
  tab: 'following' | 'friends' | 'followers' | null;
}

export default function PeopleTabContent({ tab }: PeopleTabContentProps) {
  const { account } = useAuthStateSafe();
  const router = useRouter();

  const handleBackToSearch = () => {
    router.push('/people');
  };

  const getTabTitle = () => {
    switch (tab) {
      case 'following':
        return 'Following';
      case 'friends':
        return 'Friends';
      case 'followers':
        return 'Followers';
      default:
        return '';
    }
  };

  // Use React Query to fetch edges (cached and shared)
  const { data: edgesData, isLoading: edgesLoading, error: edgesError } = useQuery(
    account?.id && tab ? socialGraphQueries.edges(account.id) : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );

  const edges = edgesData?.edges || [];
  
  // Filter edges based on tab
  let relevantEdges: Edge[] = [];
  let accountIds: string[] = [];

  if (tab === 'following') {
    relevantEdges = edges.filter(
      (e) => e.from_account_id === account?.id &&
             e.relationship === 'follow' &&
             e.status === 'accepted'
    );
    accountIds = relevantEdges.map((e) => e.to_account_id);
  } else if (tab === 'followers') {
    relevantEdges = edges.filter(
      (e) => e.to_account_id === account?.id &&
             e.relationship === 'follow' &&
             e.status === 'accepted'
    );
    accountIds = relevantEdges.map((e) => e.from_account_id);
  } else if (tab === 'friends') {
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
    
    relevantEdges = outgoingFollows.filter((e) => friendsSet.has(e.to_account_id));
    accountIds = relevantEdges.map((e) => e.to_account_id);
  }

  // Batch fetch accounts using React Query
  const { data: accountsData, isLoading: accountsLoading } = useQuery(
    accountIds.length > 0 && account?.id && tab
      ? {
          queryKey: ['accounts', 'batch', accountIds.sort().join(',')],
          queryFn: async () => {
            const res = await fetch('/api/accounts/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: accountIds }),
              credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch accounts');
            return res.json();
          },
          enabled: accountIds.length > 0,
          staleTime: 2 * 60 * 1000, // 2 minutes
        }
      : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );

  const people: Account[] = accountsData?.accounts || [];
  const loading = edgesLoading || accountsLoading;
  const error = edgesError ? (edgesError as Error).message : null;

  if (!tab) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Back to Search Button */}
        <button
          onClick={handleBackToSearch}
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to search</span>
        </button>

        {/* Loading State */}
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-foreground-muted border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {/* Back to Search Button */}
        <button
          onClick={handleBackToSearch}
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to search</span>
        </button>

        {/* Error State */}
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="space-y-4">
        {/* Back to Search Button */}
        <button
          onClick={handleBackToSearch}
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to search</span>
        </button>

        {/* Tab Title */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">{getTabTitle()}</h2>
        </div>

        {/* Empty State */}
        <div className="text-center py-12">
          <p className="text-sm text-foreground-muted">
            {tab === 'following' && 'You are not following anyone yet'}
            {tab === 'followers' && 'You have no followers yet'}
            {tab === 'friends' && 'You have no friends yet'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back to Search Button */}
      <button
        onClick={handleBackToSearch}
        className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>Back to search</span>
      </button>

      {/* Tab Title */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">{getTabTitle()}</h2>
        {people.length > 0 && (
          <p className="text-xs text-foreground-muted mt-1">
            {people.length} {people.length === 1 ? 'person' : 'people'}
          </p>
        )}
      </div>

      {/* People List */}
      <div className="space-y-2">
        {people.map((person) => (
          <PersonCard key={person.id} person={person} edges={edges} />
        ))}
      </div>
    </div>
  );
}
