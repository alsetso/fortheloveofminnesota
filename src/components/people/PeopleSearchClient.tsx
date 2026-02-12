'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import PersonCard from './PersonCard';
import PeopleTabContent from './PeopleTabContent';
import { socialGraphQueries } from '@/lib/data/queries/socialGraph';

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

export default function PeopleSearchClient() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') as 'following' | 'friends' | 'followers' | null;
  const [searchQuery, setSearchQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { account } = useAuthStateSafe();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use React Query to fetch edges (cached and shared) - pass to PersonCard to avoid N+1
  const { data: edgesData } = useQuery(
    account?.id ? socialGraphQueries.edges(account.id) : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );
  const edges = edgesData?.edges || [];

  const searchPeople = useCallback(async (query: string) => {
    if (!account) {
      setPeople([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set('q', query.trim());
      }

      const response = await fetch(`/api/people?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search people');
      }

      // Filter out current user
      const filteredPeople = (data.people || []).filter(
        (person: Person) => person.id !== account.id
      );

      setPeople(filteredPeople);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce search
    debounceTimerRef.current = setTimeout(() => {
      searchPeople(searchQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, searchPeople]);

  // Show tab content if tab is selected, otherwise show search
  if (tab) {
    return <PeopleTabContent tab={tab} />;
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <MagnifyingGlassIcon className="w-5 h-5 text-foreground-muted" />
        </div>
        <input
          type="text"
          placeholder="Search by username, first name, or last name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-surface-accent rounded-lg text-sm text-foreground placeholder:text-foreground-muted border-none focus:outline-none"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-foreground-muted border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <div className="space-y-2">
          {people.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-foreground-muted">
                {searchQuery.trim()
                  ? 'No people found matching your search'
                  : 'Start typing to search for people'}
              </p>
            </div>
          ) : (
            people.map((person) => (
              <PersonCard key={person.id} person={person} edges={edges} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
