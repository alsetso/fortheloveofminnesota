'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Post } from '@/types/post';
import PostCreationForm from './PostCreationForm';
import FeedPost from './FeedPost';
import { useAuthStateSafe } from '@/features/auth';

export default function FeedContent() {
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

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-4">
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
      </div>
    </div>
  );
}

