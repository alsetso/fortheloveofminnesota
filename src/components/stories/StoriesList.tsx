'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CameraIcon, UserCircleIcon, CalendarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface Story {
  id: string;
  author_account_id: string;
  map_id: string | null;
  visibility: string;
  created_at: string;
  author: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
  slide_count?: number;
}

/**
 * Stories List - Grid of story cards
 * Fetches real data from database
 */
export default function StoriesList() {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const searchParams = useSearchParams();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStories() {
      try {
        setLoading(true);
        setError(null);

        // Only show stories owned by the current account
        if (!account?.id) {
          setStories([]);
          setLoading(false);
          return;
        }

        // Get query parameters
        const search = searchParams?.get('search') || '';
        const filter = searchParams?.get('filter') || '';

        // Build query - only fetch current account's stories
        // Note: We only fetch user's own stories to avoid RLS recursion issues with maps.memberships
        let query = (supabase as any)
          .schema('stories')
          .from('stories')
          .select(`
            id,
            author_account_id,
            map_id,
            visibility,
            created_at
          `)
          .eq('author_account_id', account.id);

        // Apply time filter
        if (filter === 'recent') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          query = query.gte('created_at', sevenDaysAgo.toISOString());
        }

        query = query.order('created_at', { ascending: false }).limit(100);

        const { data: storiesData, error: storiesError } = await query;

        if (storiesError) {
          throw storiesError;
        }

        // Fetch slide counts for each story (only non-expired slides)
        const storyIds = (storiesData || []).map((s: any) => s.id);
        const slideCounts = new Map<string, number>();

        if (storyIds.length > 0) {
          const { data: slidesData } = await (supabase as any)
            .schema('stories')
            .from('slides')
            .select('story_id')
            .in('story_id', storyIds)
            .gt('expires_at', new Date().toISOString()); // Only count non-expired slides

          (slidesData || []).forEach((slide: any) => {
            slideCounts.set(slide.story_id, (slideCounts.get(slide.story_id) || 0) + 1);
          });
        }

        // Filter out stories with no non-expired slides (application-layer filtering)
        // Combine stories with author and slide count
        const storiesWithAuthor = (storiesData || [])
          .map((story: any) => ({
            ...story,
            author: {
              id: account.id,
              username: account.username,
              first_name: account.first_name,
              last_name: account.last_name,
              image_url: account.image_url,
            },
            slide_count: (slideCounts.get(story.id) ?? 0) as number,
          }))
          .filter((story: Story) => (story.slide_count ?? 0) > 0); // Only show stories with slides

        setStories(storiesWithAuthor);
      } catch (err: any) {
        console.error('Error fetching stories:', {
          error: err,
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          accountId: account?.id,
        });
        setError(err?.message || err?.details || err?.hint || 'Failed to load stories');
        setStories([]);
      } finally {
        setLoading(false);
      }
    }

    fetchStories();
  }, [supabase, account?.id, searchParams]);

  // Show sign-in message if not authenticated
  if (!account) {
    return (
      <div className="max-w-[1000px] mx-auto w-full px-4 py-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
          <p className="text-sm text-white/60 mb-4">
            Please sign in to view your stories
          </p>
        </div>
      </div>
    );
  }

  const ownerName = (author: Story['author']) => {
    if (author.first_name && author.last_name) {
      return `${author.first_name} ${author.last_name}`;
    }
    return author.username || 'Unknown';
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
        <h1 className="text-2xl font-bold text-white mb-2">Your Stories</h1>
        <p className="text-sm text-white/60">
          Create and manage your stories
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-md">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Stories Grid */}
      {stories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map((story) => {
            return (
              <Link
                key={story.id}
                href={`/story/${story.id}`}
                className="bg-surface border border-white/10 rounded-md overflow-hidden hover:border-white/20 transition-colors group"
              >
                {/* Cover Image */}
                <div className="aspect-video bg-surface-accent flex items-center justify-center border-b border-white/10 relative">
                  <CameraIcon className="w-16 h-16 text-white/20 group-hover:text-white/30 transition-colors" />
                  {story.slide_count != null && story.slide_count > 0 && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
                      {story.slide_count} {story.slide_count === 1 ? 'slide' : 'slides'}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Author & Date */}
                  <div className="flex items-center justify-between pt-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {story.author.image_url ? (
                        <ProfilePhoto account={story.author as unknown as import('@/features/auth').Account} size="xs" editable={false} />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-surface-accent flex items-center justify-center flex-shrink-0">
                          <UserCircleIcon className="w-4 h-4 text-white/60" />
                        </div>
                      )}
                      <span className="text-xs text-white/70 truncate">
                        {ownerName(story.author)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-white/60 flex-shrink-0">
                      <CalendarIcon className="w-3 h-3" />
                      <span>{new Date(story.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 border border-white/10 border-dashed rounded-md bg-surface/50">
          <CameraIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Stories Yet</h3>
          <p className="text-sm text-white/60 mb-4">
            Create your first story to share moments
          </p>
          <Link
            href="/stories/new"
            className="inline-block px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium"
          >
            Create Story
          </Link>
        </div>
      )}
    </div>
  );
}
