'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  MagnifyingGlassIcon,
  PlusIcon,
  CameraIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';

/**
 * Left Sidebar for Stories list
 * Search, filters, and navigation
 */
export default function StoriesLeftSidebar() {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const [searchQuery, setSearchQuery] = useState('');
  const [allStoriesCount, setAllStoriesCount] = useState(0);
  const [recentStoriesCount, setRecentStoriesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account?.id) {
      setLoading(false);
      return;
    }

    async function fetchCounts() {
      try {
        // Fetch all stories count
        const { count: allCount } = await (supabase as any)
          .schema('stories')
          .from('stories')
          .select('*', { count: 'exact', head: true })
          .eq('author_account_id', account.id);

        // Fetch recent stories count (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count: recentCount } = await (supabase as any)
          .schema('stories')
          .from('stories')
          .select('*', { count: 'exact', head: true })
          .eq('author_account_id', account.id)
          .gte('created_at', sevenDaysAgo.toISOString());

        setAllStoriesCount(allCount || 0);
        setRecentStoriesCount(recentCount || 0);
      } catch (err) {
        console.error('Error fetching story counts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCounts();
  }, [supabase, account?.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/stories?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/stories');
    }
  };

  const filters = [
    { id: 'all', label: 'All Stories', count: allStoriesCount, icon: CameraIcon },
    { id: 'recent', label: 'Recent', count: recentStoriesCount, icon: ClockIcon },
  ].filter(filter => filter.count > 0 || filter.id === 'all');

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-white/10">
        <h2 className="text-base font-semibold text-white">Stories</h2>
      </div>

      {/* Search */}
      {account && (
        <div className="p-3 border-b border-white/10">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <input
                type="text"
                placeholder="Search stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-sm text-white placeholder:text-white/60 border-none focus:outline-none focus:ring-2 focus:ring-lake-blue"
              />
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            </div>
          </form>
        </div>
      )}

      {/* Create Button */}
      {account && (
        <div className="p-3 border-b border-white/10">
          <Link
            href="/stories/new"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            New Story
          </Link>
        </div>
      )}

      {/* Filters */}
      {filters.length > 0 && (
        <div className="p-3 space-y-1 border-b border-white/10">
          {filters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => {
                  if (filter.id === 'recent') {
                    router.push('/stories?filter=recent');
                  } else {
                    router.push('/stories');
                  }
                }}
                className="w-full flex items-center justify-between gap-3 px-2 py-2 text-sm rounded-md text-white/70 hover:bg-surface-accent hover:text-white transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{filter.label}</span>
                </div>
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="text-xs text-white/50">{filter.count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
