'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  MagnifyingGlassIcon,
  PlusIcon,
  DocumentTextIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';

/**
 * Left Sidebar for Pages list
 * Search, filters, and navigation
 */
export default function PagesLeftSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const [searchQuery, setSearchQuery] = useState('');
  const [allPagesCount, setAllPagesCount] = useState(0);
  const [recentPagesCount, setRecentPagesCount] = useState(0);
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accountId = account?.id;
    if (!accountId) {
      setLoading(false);
      return;
    }

    async function fetchCounts() {
      try {
        // Fetch all pages count
        const { count: allCount } = await (supabase as any)
          .schema('pages')
          .from('pages')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', accountId);

        // Fetch recent pages count (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count: recentCount } = await (supabase as any)
          .schema('pages')
          .from('pages')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', accountId)
          .gte('created_at', sevenDaysAgo.toISOString());

        // Fetch all pages to extract unique tags
        const { data: pagesData } = await (supabase as any)
          .schema('pages')
          .from('pages')
          .select('tags')
          .eq('owner_id', accountId)
          .not('tags', 'is', null);

        // Count tags
        const tagCounts = new Map<string, number>();
        (pagesData || []).forEach((page: any) => {
          if (page.tags && Array.isArray(page.tags)) {
            page.tags.forEach((tag: string) => {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
          }
        });

        const tagsArray = Array.from(tagCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10); // Top 10 tags

        setAllPagesCount(allCount || 0);
        setRecentPagesCount(recentCount || 0);
        setTags(tagsArray);
      } catch (err) {
        console.error('Error fetching page counts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCounts();
  }, [supabase, account?.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/pages?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/pages');
    }
  };

  const filters = [
    { id: 'all', label: 'All Pages', count: allPagesCount, icon: DocumentTextIcon },
    { id: 'recent', label: 'Recent', count: recentPagesCount, icon: ClockIcon },
  ].filter(filter => filter.count > 0 || filter.id === 'all'); // Show "All" even if 0, hide others if 0

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-white/10">
        <h2 className="text-base font-semibold text-white">Pages</h2>
      </div>

      {/* Search */}
      {account && (
        <div className="p-3 border-b border-white/10">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <input
                type="text"
                placeholder="Search pages..."
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
      <div className="p-3 border-b border-white/10">
        <Link
          href="/pages/new"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          New Page
        </Link>
      </div>

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
                    router.push('/pages?filter=recent');
                  } else {
                    router.push('/pages');
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

      {/* Tags (Collections) */}
      {tags.length > 0 && (
        <div className="p-3">
          <h3 className="text-xs font-semibold text-white/60 mb-2">Tags</h3>
          <div className="space-y-1">
            {tags.map((tagItem) => (
              <button
                key={tagItem.tag}
                onClick={() => router.push(`/pages?tag=${encodeURIComponent(tagItem.tag)}`)}
                className="w-full flex items-center justify-between gap-3 px-2 py-2 text-sm rounded-md text-white/70 hover:bg-surface-accent hover:text-white transition-colors"
              >
                <span className="truncate">{tagItem.tag}</span>
                <span className="text-xs text-white/50">{tagItem.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
