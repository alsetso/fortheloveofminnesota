'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PhotoIcon, UserCircleIcon, CalendarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface Page {
  id: string;
  title: string;
  slug: string | null;
  icon: string | null;
  cover_url: string | null;
  description: string | null;
  visibility: 'private' | 'public' | 'shared';
  created_at: string;
  updated_at: string;
  owner: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
}

/**
 * Pages List - Grid of page cards
 * Fetches real data from database
 */
export default function PagesList() {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const searchParams = useSearchParams();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPages() {
      try {
        setLoading(true);
        setError(null);

        // Only show pages owned by the current account
        if (!account?.id) {
          setPages([]);
          setLoading(false);
          return;
        }

        // Get query parameters
        const search = searchParams?.get('search') || '';
        const filter = searchParams?.get('filter') || '';
        const tag = searchParams?.get('tag') || '';

        // Build query - only fetch current account's pages
        let query = (supabase as any)
          .schema('pages')
          .from('pages')
          .select(`
            id,
            title,
            slug,
            icon,
            cover_url,
            description,
            visibility,
            created_at,
            updated_at,
            owner_id,
            tags
          `)
          .eq('owner_id', account.id);

        // Apply search filter
        if (search) {
          query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
        }

        // Apply tag filter
        if (tag) {
          query = query.contains('tags', [tag]);
        }

        // Apply time filter
        if (filter === 'recent') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          query = query.gte('created_at', sevenDaysAgo.toISOString());
        }

        query = query.order('created_at', { ascending: false }).limit(100);

        const { data: pagesData, error: pagesError } = await query;

        if (pagesError) {
          throw pagesError;
        }

        // All pages belong to the current account, so use account data as owner
        const pagesWithOwner = (pagesData || []).map((page: any) => ({
          ...page,
          owner: {
            id: account.id,
            username: account.username,
            first_name: account.first_name,
            last_name: account.last_name,
            image_url: account.image_url,
          },
        }));

        setPages(pagesWithOwner);
      } catch (err: any) {
        console.error('Error fetching pages:', err);
        setError(err?.message || 'Failed to load pages');
        setPages([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPages();
  }, [supabase, account?.id, searchParams]);

  // Show sign-in message if not authenticated
  if (!account) {
    return (
      <div className="max-w-[1000px] mx-auto w-full px-4 py-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
          <p className="text-sm text-white/60 mb-4">
            Please sign in to view your pages
          </p>
        </div>
      </div>
    );
  }

  const ownerName = (owner: Page['owner']) => {
    if (owner.first_name && owner.last_name) {
      return `${owner.first_name} ${owner.last_name}`;
    }
    return owner.username || 'Unknown';
  };

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Your Pages</h1>
        <p className="text-sm text-white/60">
          Manage and navigate to all your pages
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-md">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Pages Grid */}
      {pages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => {
            const href = page.slug ? `/page/${page.slug}` : `/page/${page.id}`;
            return (
              <Link
                key={page.id}
                href={href}
                className="bg-surface border border-white/10 rounded-md overflow-hidden hover:border-white/20 transition-colors group"
              >
                {/* Cover Image */}
                <div className="aspect-video bg-surface-accent flex items-center justify-center border-b border-white/10 relative">
                  {page.cover_url ? (
                    <img 
                      src={page.cover_url} 
                      alt={page.title}
                      className="w-full h-full object-cover"
                    />
                  ) : page.icon ? (
                    <span className="text-6xl">{page.icon}</span>
                  ) : (
                    <PhotoIcon className="w-16 h-16 text-white/20 group-hover:text-white/30 transition-colors" />
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Title */}
                  <h3 className="text-base font-semibold text-white mb-2 line-clamp-2 group-hover:text-lake-blue transition-colors">
                    {page.title}
                  </h3>

                  {/* Description */}
                  {page.description && (
                    <p className="text-sm text-white/70 mb-3 line-clamp-2">
                      {page.description}
                    </p>
                  )}

                  {/* Author & Date */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      {page.owner.image_url ? (
                        <ProfilePhoto account={page.owner} size="xs" editable={false} />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-surface-accent flex items-center justify-center flex-shrink-0">
                          <UserCircleIcon className="w-4 h-4 text-white/60" />
                        </div>
                      )}
                      <span className="text-xs text-white/70 truncate">
                        {ownerName(page.owner)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-white/60 flex-shrink-0">
                      <CalendarIcon className="w-3 h-3" />
                      <span>{new Date(page.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 border border-white/10 border-dashed rounded-md bg-surface/50">
          <DocumentTextIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Pages Yet</h3>
          <p className="text-sm text-white/60 mb-4">
            Create your first page to share knowledge and organize information
          </p>
          <Link
            href="/pages/new"
            className="inline-block px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium"
          >
            Create Page
          </Link>
        </div>
      )}
    </div>
  );
}
