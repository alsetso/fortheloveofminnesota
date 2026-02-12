'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Post } from '@/types/post';
import PostComposer from './PostComposer';
import CreatePostModal from './CreatePostModal';
import PostCard from './PostCard';

/**
 * Feed component with Stories, PostComposer, and PostCard[]
 * Infinite scroll pattern with compact design system
 */
export default function NewFeed() {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const offsetRef = useRef(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(
    async (reset = false) => {
      if (reset) {
        offsetRef.current = 0;
        setIsLoading(true);
        setError(null);
      }

      try {
        const url = new URL('/api/posts', window.location.origin);
        url.searchParams.set('limit', '20');
        url.searchParams.set('offset', offsetRef.current.toString());

        const response = await fetch(url.toString(), { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
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
        console.error('Error fetching posts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setIsLoading(false);
      }
    },
    [searchParams],
  );

  // Initial load
  useEffect(() => {
    fetchPosts(true);
  }, [fetchPosts]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          fetchPosts();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoading, fetchPosts]);

  const handlePostCreated = () => {
    fetchPosts(true);
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-[600px] mx-auto w-full px-4 py-6 space-y-3">
      {/* Post Composer - opens modal when clicked (only for posts) */}
      <PostComposer onPostCreated={handlePostCreated} onOpenModal={() => setIsModalOpen(true)} />
      
      {/* Create Post Modal - centered overlay */}
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPostCreated={handlePostCreated}
        createMode="post"
      />

      {/* Posts */}
      {isLoading && posts.length === 0 && (
        <div className="text-center text-foreground-subtle text-xs py-8">
          Loading feed...
        </div>
      )}

      {error && posts.length === 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-md p-3">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => fetchPosts(true)}
            className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      {posts.length > 0 && (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}

          {/* Infinite scroll trigger */}
          <div ref={observerTarget} className="h-4" />

          {isLoading && posts.length > 0 && (
            <div className="text-center text-foreground-subtle text-xs py-4">
              Loading more...
            </div>
          )}
        </>
      )}

      {!isLoading && posts.length === 0 && !error && (
        <div className="text-center text-foreground-subtle text-xs py-8">
          No posts yet. Be the first to post!
        </div>
      )}
    </div>
  );
}
