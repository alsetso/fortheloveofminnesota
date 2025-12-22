'use client';

import { useState, useEffect, useCallback } from 'react';
import FeedPost, { FeedPostData } from './FeedPost';
import { PostCreationCard } from '@/features/posts';
import { GlobeAltIcon, UserGroupIcon, LockClosedIcon, UserIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/features/auth';

interface LocationPostsFeedProps {
  city?: string;
  county?: string;
  locationName: string;
  locationType: 'city' | 'county';
}

type VisibilityFilter = 'all' | 'public' | 'members_only' | 'only_me';

export default function LocationPostsFeed({ 
  city, 
  county, 
  locationName,
  locationType 
}: LocationPostsFeedProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');

  const fetchPosts = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    
    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: currentOffset.toString(),
      });

      if (city) {
        params.append('city', city);
      }
      if (county) {
        params.append('county', county);
      }
      if (visibilityFilter !== 'all') {
        params.append('visibility', visibilityFilter);
      }

      const response = await fetch(`/api/feed?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
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
  }, [offset, city, county, visibilityFilter]);

  useEffect(() => {
    setOffset(0);
    setIsLoading(true);
    fetchPosts(true);
  }, [city, county, visibilityFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePostCreated = () => {
    fetchPosts(true);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      setIsLoading(true);
      fetchPosts();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Posts about {locationName}
          </h2>
          <p className="text-gray-600">
            Community posts and discussions about this {locationType === 'city' ? 'city' : 'county'}.
          </p>
        </div>

        {/* Visibility Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">Filter:</span>
          <div className="flex items-center gap-1 bg-white border border-[#dfdedc] rounded-lg p-1">
            <button
              onClick={() => setVisibilityFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-1.5 ${
                visibilityFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setVisibilityFilter('public')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-1.5 ${
                visibilityFilter === 'public'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <GlobeAltIcon className="w-4 h-4" />
              Public
            </button>
            <button
              onClick={() => setVisibilityFilter('members_only')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-1.5 ${
                visibilityFilter === 'members_only'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <UserGroupIcon className="w-4 h-4" />
              Members
            </button>
            {user && (
              <button
                onClick={() => setVisibilityFilter('only_me')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-1.5 ${
                  visibilityFilter === 'only_me'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                Only Me
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create Post Card */}
      <PostCreationCard 
        onPostCreated={handlePostCreated}
      />

      {/* Feed Posts */}
      {isLoading && posts.length === 0 ? (
        <div className="bg-white border border-[#dfdedc] rounded-lg p-8 text-center">
          <div className="text-gray-500">Loading posts...</div>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="bg-white border border-[#dfdedc] rounded-lg p-8 text-center">
              <p className="text-gray-500 mb-4">No posts yet about {locationName}.</p>
              <p className="text-sm text-gray-400">Be the first to share something about this {locationType === 'city' ? 'city' : 'county'}!</p>
            </div>
          ) : (
            posts.map((post) => (
              <FeedPost key={post.id} post={post} onUpdate={handlePostCreated} />
            ))
          )}
        </div>
      )}

      {/* Load More */}
      {hasMore && posts.length > 0 && (
        <div className="text-center pt-4">
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

