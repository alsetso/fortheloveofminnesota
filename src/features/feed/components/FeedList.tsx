'use client';

import { useState, useEffect, useCallback } from 'react';
import FeedPost, { FeedPostData } from './FeedPost';
import { PostCreationCard } from '@/features/posts';

export default function FeedList() {
  const [posts, setPosts] = useState<FeedPostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchPosts = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    
    try {
      const response = await fetch(`/api/feed?limit=20&offset=${currentOffset}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        // API handles anonymous users, so 401 shouldn't happen for public posts
        // But handle it gracefully
        if (response.status === 401) {
          // Return empty feed for unauthenticated users (they'll see public posts via RLS)
          if (reset) {
            setPosts([]);
          }
          setHasMore(false);
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to fetch feed');
      }
      
      const data = await response.json();
      
      if (reset) {
        setPosts(data.posts || []);
      } else {
        setPosts(prev => [...prev, ...(data.posts || [])]);
      }
      
      setHasMore(data.hasMore);
      setOffset(currentOffset + (data.posts?.length || 0));
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchPosts(true);
  }, []);

  const handlePostCreated = () => {
    fetchPosts(true);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      setIsLoading(true);
      fetchPosts();
    }
  };

  if (isLoading && posts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading feed...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Create Post Card */}
      <PostCreationCard onPostCreated={handlePostCreated} />

      {/* Feed Posts */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="bg-white border border-[#dfdedc] rounded-lg p-8 text-center">
            <p className="text-gray-500 mb-4">No posts yet.</p>
            <p className="text-sm text-gray-400">Be the first to share something with the Minnesota community!</p>
          </div>
        ) : (
          posts.map((post) => (
            <FeedPost key={post.id} post={post} onUpdate={handlePostCreated} />
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="px-6 py-2 bg-white border-2 border-gray-300 rounded-lg font-semibold text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

