'use client';

import { useState, useEffect, useCallback } from 'react';
import { Post } from '@/types/post';
import FeedPost from '@/components/feed/FeedPost';
import PostCreationForm from '@/components/feed/PostCreationForm';
import SidebarHeader from '@/components/layout/SidebarHeader';

interface MapPostsProps {
  mapId: string;
  mapSlug?: string | null;
  onClose?: () => void;
}

export default function MapPosts({ mapId, mapSlug, onClose }: MapPostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only allow posts on live map - posts removed from custom maps
  const isLiveMap = mapSlug === 'live' || mapId === 'live';

  const fetchPosts = useCallback(async () => {
    if (!isLiveMap) {
      setIsLoading(false);
      return;
    }

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
  }, [mapId, isLiveMap]);

  useEffect(() => {
    if (mapId && isLiveMap) {
      fetchPosts();
    } else {
      setIsLoading(false);
    }
  }, [mapId, isLiveMap, fetchPosts]);

  const handlePostCreated = () => {
    fetchPosts();
  };

  return (
    <div className="h-full flex flex-col">
      <SidebarHeader
        title="Posts"
        onClose={onClose || (() => {})}
        showMenu={false}
      />
      {/* Fixed Post Creation Form at Top of Container */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 p-[10px]">
        <PostCreationForm onPostCreated={handlePostCreated} mapId={mapId} />
      </div>
      {/* Scrollable Posts Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
        {isLoading ? (
          <div className="p-[10px]">
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ) : error ? (
          <div className="p-[10px]">
            <div className="text-xs text-red-600">{error}</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-[10px]">
            <div className="text-xs text-gray-500 text-center py-6">
              No posts yet on this map
            </div>
          </div>
        ) : (
          <div className="p-[10px]">
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
        )}
      </div>
    </div>
  );
}
