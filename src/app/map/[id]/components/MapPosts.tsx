'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Post } from '@/types/post';
import FeedPost from '@/components/feed/FeedPost';
import PostCreationForm from '@/components/feed/PostCreationForm';

interface MapPostsProps {
  mapId: string;
  onClose?: () => void;
}

export default function MapPosts({ mapId, onClose }: MapPostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts?map_id=${mapId}&limit=50`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error('Error fetching map posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  }, [mapId]);

  useEffect(() => {
    if (mapId) {
      fetchPosts();
    }
  }, [mapId, fetchPosts]);

  const handlePostCreated = () => {
    fetchPosts();
  };

  if (isLoading) {
    return (
      <div className="p-[10px]">
        <div className="flex items-center justify-center py-6">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-[10px]">
        <div className="text-xs text-red-600">{error}</div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="p-[10px]">
        <div className="mb-3">
          <PostCreationForm onPostCreated={handlePostCreated} mapId={mapId} />
        </div>
        <div className="text-xs text-gray-500 text-center py-6">
          No posts yet on this map
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-[10px]">
          {/* Post Creation Form */}
          <div className="mb-3">
            <PostCreationForm onPostCreated={handlePostCreated} mapId={mapId} />
          </div>
          
          {posts.map((post, index) => (
            <div key={post.id} className="relative pb-1">
              {/* Vertical line connecting avatars - positioned at center of 6x6 avatar (3px from left edge) */}
              {index < posts.length - 1 && (
                <div className="absolute left-[13px] top-6 bottom-0 w-px bg-gray-200 z-0" />
              )}
              <div className="relative z-10">
                <FeedPost 
                  post={post} 
                  variant="card" 
                  compact 
                  isFirst={index === 0}
                  isLast={index === posts.length - 1}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
