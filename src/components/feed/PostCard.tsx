'use client';

import { useState, useEffect } from 'react';
import { Post } from '@/types/post';
import type { Account } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PostContent from '@/components/posts/PostContent';
import { GlobeAltIcon, LockClosedIcon, BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';
import CreatePostModal from './CreatePostModal';

interface PostCardProps {
  post: Post;
}

/**
 * Post card component following compact feed design system
 * Uses text-xs, gap-2, p-[10px] spacing
 */
export default function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const account = post.account;
  
  // Get display name (first_name + last_name or first_name)
  const displayName = account?.first_name && account?.last_name
    ? `${account.first_name} ${account.last_name}`
    : account?.first_name || null;
  
  // Get username
  const username = account?.username || null;

  // Update time on client only to avoid hydration mismatch
  useEffect(() => {
    if (post.created_at) {
      setTimeAgo(formatDistanceToNow(new Date(post.created_at), { addSuffix: true }));
    }
  }, [post.created_at]);

  // Check bookmark status on mount
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      try {
        const response = await fetch(`/api/posts/${post.id}/bookmark`);
        if (response.ok) {
          const data = await response.json();
          setIsBookmarked(data.bookmarked || false);
        }
      } catch (error) {
        // Silently fail - bookmark status is optional
        console.error('Error checking bookmark status:', error);
      }
    };

    checkBookmarkStatus();
  }, [post.id]);

  const handleOptionsClick = () => {
    router.push(`/post/${post.id}`);
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isBookmarking) return;
    
    setIsBookmarking(true);
    try {
      const response = await fetch(`/api/posts/${post.id}/bookmark`, {
        method: isBookmarked ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setIsBookmarked(!isBookmarked);
      } else {
        const data = await response.json();
        console.error('Failed to bookmark post:', data.error);
      }
    } catch (error) {
      console.error('Error bookmarking post:', error);
    } finally {
      setIsBookmarking(false);
    }
  };

  const isSharedPost = post.shared_post_id && post.shared_post;
  const sharedPost = post.shared_post;
  const sharedPostAccount = sharedPost?.account;

  // Get shared post display name and username
  const sharedPostDisplayName = sharedPostAccount?.first_name && sharedPostAccount?.last_name
    ? `${sharedPostAccount.first_name} ${sharedPostAccount.last_name}`
    : sharedPostAccount?.first_name || null;
  const sharedPostUsername = sharedPostAccount?.username || null;

  // Format shared post time
  const [sharedPostTimeAgo, setSharedPostTimeAgo] = useState<string>('');
  useEffect(() => {
    if (sharedPost?.created_at) {
      setSharedPostTimeAgo(formatDistanceToNow(new Date(sharedPost.created_at), { addSuffix: true }));
    }
  }, [sharedPost?.created_at]);

  return (
    <article className={`bg-surface rounded-md mb-3 border border-gray-200 dark:border-gray-700 ${post.background_color ? 'py-3' : 'p-3'}`}>
      {/* Header: Avatar + Username + Group + Time + Options */}
      <div className={`flex items-start gap-2 mb-3 ${post.background_color ? 'px-3' : ''}`}>
        {account && (
          <ProfilePhoto 
            account={account as unknown as Account} 
            size="sm" 
            editable={false}
            className="flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="leading-none">
            {/* Name and metadata on first line */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {displayName ? (
                <span className="text-sm font-semibold text-foreground">
                  {displayName}
                </span>
              ) : !username ? (
                <span className="text-sm font-semibold text-foreground">Anonymous</span>
              ) : null}
              {post.map && (
                <>
                  <span className="text-foreground-muted">·</span>
                  <span className="text-xs text-foreground-muted hover:text-foreground hover:underline cursor-pointer">
                    {post.map.name}
                  </span>
                </>
              )}
              {post.created_at && timeAgo && (
                <>
                  <span className="text-foreground-muted">·</span>
                  <span className="text-xs text-foreground-subtle">
                    {timeAgo}
                  </span>
                </>
              )}
              {post.visibility && (
                <>
                  <span className="text-foreground-muted">·</span>
                  {post.visibility === 'public' ? (
                    <GlobeAltIcon className="w-3 h-3 text-foreground-muted" title="Public" />
                  ) : (
                    <LockClosedIcon className="w-3 h-3 text-foreground-muted" title="Draft" />
                  )}
                </>
              )}
            </div>
            {/* Username on second line */}
            {username && (
              <div className="-mt-0.5">
                <Link
                  href={`/${encodeURIComponent(username)}`}
                  className="text-xs text-foreground-muted hover:text-foreground hover:underline leading-none block"
                >
                  @{username}
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleOptionsClick}
            className="w-8 h-8 rounded-full hover:bg-surface-accent dark:hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="Post options"
          >
            <svg className="w-5 h-5 text-foreground-muted" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sharer's caption/content - only show if NOT a shared post or if there's actual content */}
      {!isSharedPost && post.content && (
        <div className={`text-sm break-words transition-all ${
          post.background_color 
            ? 'w-full mb-0' 
            : 'text-foreground px-3 mb-3'
        }`}>
          <PostContent 
            content={post.content} 
            taggedAccounts={post.tagged_accounts}
            className="whitespace-pre-wrap"
            backgroundColor={post.background_color || null}
          />
        </div>
      )}

      {/* Sharer's images - only show if NOT a shared post */}
      {!isSharedPost && post.images && Array.isArray(post.images) && post.images.length > 0 && (
        <div className={`mb-3 ${post.background_color ? '' : '-mx-3'}`}>
          {post.images.map((img: any, idx: number) => (
            <img
              key={idx}
              src={img.url || img}
              alt={post.title || 'Post image'}
              className="w-full max-h-[500px] object-cover"
            />
          ))}
        </div>
      )}

      {/* Shared Post Content */}
      {isSharedPost && sharedPost && (
        <div className="mb-3">
          {/* Nested shared post card */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 overflow-hidden">
            {/* Shared post images */}
            {sharedPost.images && Array.isArray(sharedPost.images) && sharedPost.images.length > 0 && (
              <div className="mb-3">
                {sharedPost.images.map((img: any, idx: number) => (
                  <img
                    key={idx}
                    src={img.url || img}
                    alt={sharedPost.title || 'Shared post image'}
                    className="w-full max-h-[500px] object-cover"
                  />
                ))}
              </div>
            )}

            {/* Shared post content */}
            {sharedPost.content && (
              <div className={`text-sm break-words px-3 mb-3 ${
                sharedPost.background_color 
                  ? 'w-full' 
                  : 'text-foreground'
              }`}>
                <PostContent 
                  content={sharedPost.content} 
                  taggedAccounts={sharedPost.tagged_accounts}
                  className="whitespace-pre-wrap"
                  backgroundColor={sharedPost.background_color || null}
                />
              </div>
            )}

            {/* Original post owner info */}
            <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
              {sharedPostAccount && (
                <ProfilePhoto 
                  account={sharedPostAccount as unknown as Account} 
                  size="xs" 
                  editable={false}
                  className="flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {sharedPostDisplayName ? (
                    <span className="text-xs font-semibold text-foreground">
                      {sharedPostDisplayName}
                    </span>
                  ) : sharedPostUsername ? (
                    <span className="text-xs font-semibold text-foreground">@{sharedPostUsername}</span>
                  ) : (
                    <span className="text-xs font-semibold text-foreground">Anonymous</span>
                  )}
                  {sharedPost?.created_at && sharedPostTimeAgo && (
                    <>
                      <span className="text-foreground-muted">·</span>
                      <span className="text-xs text-foreground-subtle">
                        {sharedPostTimeAgo}
                      </span>
                    </>
                  )}
                  {sharedPost?.visibility === 'public' && (
                    <>
                      <span className="text-foreground-muted">·</span>
                      <GlobeAltIcon className="w-3 h-3 text-foreground-muted" title="Public" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer: Actions */}
      <div className={`flex items-center gap-4 pt-3 border-t border-border-muted dark:border-white/10 ${post.background_color ? 'px-3' : ''}`}>
        <button 
          onClick={handleBookmark}
          disabled={isBookmarking}
          className={`flex items-center gap-2 text-sm transition-colors ${
            isBookmarked
              ? 'text-foreground'
              : 'text-foreground-muted hover:text-foreground'
          } ${isBookmarking ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isBookmarked ? (
            <BookmarkIconSolid className="w-5 h-5" />
          ) : (
            <BookmarkIcon className="w-5 h-5" />
          )}
          {isBookmarked ? 'Saved' : 'Save'}
        </button>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowShareModal(true);
          }}
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      </div>
      
      {/* Share Modal */}
      {showShareModal && (
        <CreatePostModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          sharedPost={post}
          createMode="post"
        />
      )}
    </article>
  );
}
