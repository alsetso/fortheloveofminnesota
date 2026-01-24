'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Post } from '@/types/post';
import PostCreationForm from './PostCreationForm';
import FeedPost from './FeedPost';
import GroupsSidebar from './GroupsSidebar';
import MentionTypeFilter from './MentionTypeFilter';
import MentionTimeFilter from './MentionTimeFilter';
import { useAuthStateSafe } from '@/features/auth';

export default function FeedContent() {
  const { account } = useAuthStateSafe();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  // Fetch posts
  const fetchPosts = useCallback(async (reset = false) => {
    if (reset) {
      offsetRef.current = 0;
      setIsLoading(true);
      setError(null);
    }

    try {
      // Get mention time filter from URL
      const mentionTime = searchParams.get('mention_time') || 'all';
      const url = new URL('/api/posts', window.location.origin);
      url.searchParams.set('limit', '20');
      url.searchParams.set('offset', offsetRef.current.toString());
      if (mentionTime !== 'all') {
        url.searchParams.set('mention_time', mentionTime);
      }

      const response = await fetch(url.toString(), {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const newPosts = data.posts || [];

      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setHasMore(newPosts.length === 20);
      offsetRef.current += newPosts.length;
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  // Load posts on mount and when filters change
  const mentionTimeRef = useRef<string | null>(null);
  
  useEffect(() => {
    const currentMentionTime = searchParams.get('mention_time');
    const previousMentionTime = mentionTimeRef.current;
    
    // Only refetch if mention_time actually changed
    if (previousMentionTime !== currentMentionTime) {
      mentionTimeRef.current = currentMentionTime;
      offsetRef.current = 0;
      fetchPosts(true);
    } else if (previousMentionTime === null) {
      // Initial load
      mentionTimeRef.current = currentMentionTime;
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - 3 columns */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-6 space-y-6">
              <MentionTimeFilter />
              <MentionTypeFilter />
            </div>
          </div>

          {/* Middle Column - 6 columns */}
          <div className="lg:col-span-6 space-y-4">
            {/* Post Creation Form */}
            {account && <PostCreationForm onPostCreated={handlePostCreated} />}

            {/* Loading State */}
            {isLoading && posts.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">
                Loading feed...
              </div>
            )}

            {/* Error State */}
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

            {/* Posts */}
            {posts.length > 0 && (
              <>
                {posts.map((post) => (
                  <FeedPost key={post.id} post={post} />
                ))}

                {/* Load More */}
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

            {/* Empty State */}
            {!isLoading && posts.length === 0 && !error && (
              <div className="text-center text-gray-500 text-sm py-8">
                No posts yet. Be the first to post!
              </div>
            )}
          </div>

          {/* Right Column - 3 columns */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-6 space-y-6">
              <GroupsSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

