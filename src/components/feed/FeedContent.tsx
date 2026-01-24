'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Post } from '@/types/post';
import PostCreationForm from './PostCreationForm';
import FeedPost from './FeedPost';
import GroupsSidebar from './GroupsSidebar';
import MentionTypeFilter from './MentionTypeFilter';
import MentionTimeFilter from './MentionTimeFilter';
import LiveMapAnalyticsCard from './LiveMapAnalyticsCard';
import { useAuthStateSafe } from '@/features/auth';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function FeedContent({
  leftSidebarVisible = true,
  rightSidebarVisible = true,
  leftPanelOpen = false,
  rightPanelOpen = false,
  onRequestCloseLeftPanel,
  onRequestCloseRightPanel,
}: {
  leftSidebarVisible?: boolean;
  rightSidebarVisible?: boolean;
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  onRequestCloseLeftPanel?: () => void;
  onRequestCloseRightPanel?: () => void;
}) {
  const { account } = useAuthStateSafe();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const fetchPosts = useCallback(
    async (reset = false) => {
      if (reset) {
        offsetRef.current = 0;
        setIsLoading(true);
        setError(null);
      }

      try {
        const mentionTime = searchParams.get('mention_time') || 'all';
        const mentionTypeSlug = searchParams.get('type');

        const url = new URL('/api/posts', window.location.origin);
        url.searchParams.set('limit', '20');
        url.searchParams.set('offset', offsetRef.current.toString());

        if (mentionTime !== 'all') {
          url.searchParams.set('mention_time', mentionTime);
        }

        if (mentionTypeSlug) {
          const { supabase } = await import('@/lib/supabase');
          const { data: mentionTypes } = await supabase
            .from('mention_types')
            .select('id, name')
            .eq('is_active', true)
            .ilike('name', mentionTypeSlug.replace(/-/g, ' '));

          if (mentionTypes && mentionTypes.length > 0) {
            url.searchParams.set('mention_type_id', mentionTypes[0].id);
          }
        }

        const response = await fetch(url.toString(), { credentials: 'include' });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const newPosts = (data?.posts ?? []) as Post[];

        if (reset) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }

        setHasMore(newPosts.length === 20);
        offsetRef.current += newPosts.length;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error fetching posts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setIsLoading(false);
      }
    },
    [searchParams],
  );

  const mentionTimeRef = useRef<string | null>(null);
  const mentionTypeRef = useRef<string | null>(null);

  useEffect(() => {
    const currentMentionTime = searchParams.get('mention_time');
    const currentMentionType = searchParams.get('type');
    const previousMentionTime = mentionTimeRef.current;
    const previousMentionType = mentionTypeRef.current;

    if (previousMentionTime !== currentMentionTime || previousMentionType !== currentMentionType) {
      mentionTimeRef.current = currentMentionTime;
      mentionTypeRef.current = currentMentionType;
      offsetRef.current = 0;
      fetchPosts(true);
    } else if (previousMentionTime === null && previousMentionType === null) {
      mentionTimeRef.current = currentMentionTime;
      mentionTypeRef.current = currentMentionType;
      fetchPosts(true);
    }
  }, [searchParams, fetchPosts]);

  const handlePostCreated = () => {
    fetchPosts(true);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore && !error) {
      fetchPosts();
    }
  };

  const centerColSpanClass =
    leftSidebarVisible && rightSidebarVisible
      ? 'lg:col-span-6'
      : leftSidebarVisible || rightSidebarVisible
        ? 'lg:col-span-9'
        : 'lg:col-span-12';

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      {/* Mobile left panel (filters) */}
      {leftPanelOpen && (
        <div className="lg:hidden fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close filters panel"
            onClick={onRequestCloseLeftPanel}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[86%] max-w-[360px] bg-white border-r border-gray-200 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-900">Filters</div>
              <button
                type="button"
                onClick={onRequestCloseLeftPanel}
                className="w-8 h-8 rounded-md hover:bg-gray-50 flex items-center justify-center transition-colors"
                aria-label="Close filters panel"
              >
                <XMarkIcon className="w-5 h-5 text-gray-700" />
              </button>
            </div>
            <div className="p-3 space-y-3">
              <MentionTimeFilter />
              <MentionTypeFilter />
            </div>
          </div>
        </div>
      )}

      {/* Mobile right panel (more) */}
      {rightPanelOpen && (
        <div className="lg:hidden fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close sidebar panel"
            onClick={onRequestCloseRightPanel}
          />
          <div className="absolute right-0 top-0 bottom-0 w-[86%] max-w-[360px] bg-white border-l border-gray-200 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-900">More</div>
              <button
                type="button"
                onClick={onRequestCloseRightPanel}
                className="w-8 h-8 rounded-md hover:bg-gray-50 flex items-center justify-center transition-colors"
                aria-label="Close sidebar panel"
              >
                <XMarkIcon className="w-5 h-5 text-gray-700" />
              </button>
            </div>
            <div className="p-3 space-y-3">
              <LiveMapAnalyticsCard />
              <GroupsSidebar />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {leftSidebarVisible && (
            <div className="hidden lg:block lg:col-span-3">
              <div className="lg:sticky lg:top-6 space-y-6">
                <MentionTimeFilter />
                <MentionTypeFilter />
              </div>
            </div>
          )}

          <div className={`${centerColSpanClass} space-y-4`}>
            {account && <PostCreationForm onPostCreated={handlePostCreated} />}

            {isLoading && posts.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">Loading feed...</div>
            )}

            {error && posts.length === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={() => fetchPosts(true)}
                  className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
                >
                  Try again
                </button>
              </div>
            )}

            {posts.length > 0 && (
              <>
                {/* No top/bottom border: only separators between records */}
                <div className="divide-y divide-gray-200">
                  {posts.map((post, index) => (
                    <FeedPost
                      key={post.id}
                      post={post}
                      variant="timeline"
                      isFirst={index === 0}
                      isLast={index === posts.length - 1}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="text-center py-4">
                    <button
                      onClick={handleLoadMore}
                      disabled={isLoading}
                      className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}

            {!isLoading && posts.length === 0 && !error && (
              <div className="text-center text-gray-500 text-sm py-8">No posts yet. Be the first to post!</div>
            )}
          </div>

          {rightSidebarVisible && (
            <div className="hidden lg:block lg:col-span-3">
              <div className="lg:sticky lg:top-6 space-y-6">
                <LiveMapAnalyticsCard />
                <GroupsSidebar />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

