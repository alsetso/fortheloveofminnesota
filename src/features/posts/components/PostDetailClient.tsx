'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPinIcon, EllipsisVerticalIcon, ShareIcon, CheckIcon, PencilIcon, TrashIcon, EyeIcon, ArrowLeftIcon, GlobeAltIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { usePageView } from '@/hooks/usePageView';
import { useAuthStateSafe } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import MentionCard from '@/components/feed/MentionCard';
import { Account } from '@/features/auth';

interface PostDetailClientProps {
  post: {
    id: string;
    account_id: string;
    title: string | null;
    content: string;
    visibility: 'public' | 'draft';
    group_id: string | null;
    mention_ids: string[] | null;
    images: Array<{
      url: string;
      alt?: string;
      type?: 'image' | 'video';
      width?: number;
      height?: number;
    }> | null;
    map_data: {
      lat: number;
      lng: number;
      address?: string;
      place_name?: string;
      type?: 'pin' | 'area' | 'both';
      geometry?: any;
      screenshot?: string;
    } | null;
    view_count?: number | null;
    created_at: string;
    updated_at: string;
    mention_type?: {
      id: string;
      emoji: string;
      name: string;
    } | null;
    mention_type_id?: string | null;
    account?: {
      id: string;
      username: string | null;
      first_name: string | null;
      last_name: string | null;
      image_url: string | null;
      plan: string | null;
    } | null;
    mentions?: Array<{
      id: string;
      lat: number;
      lng: number;
      description: string | null;
      image_url: string | null;
      account_id: string | null;
      mention_type?: {
        emoji: string;
        name: string;
      } | null;
      collection?: {
        emoji: string;
        title: string;
      } | null;
    }> | null;
  };
  isOwner: boolean;
}

export default function PostDetailClient({ post, isOwner }: PostDetailClientProps) {
  const { account } = useAuthStateSafe();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [viewCount, setViewCount] = useState(post.view_count || 0);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // Close image modal on escape key
  useEffect(() => {
    if (selectedImageIndex === null) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedImageIndex(null);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedImageIndex]);

  // Track page view
  usePageView({ page_url: `/post/${post.id}` });

  // Optimistically increment view count on mount
  useEffect(() => {
    setViewCount(prev => prev + 1);
  }, []);

  const accountName = post.account?.first_name || post.account?.username || 'Anonymous';
  const username = post.account?.username || 'unknown';
  const createdDate = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  
  // Calculate relative time
  const getRelativeTime = (date: string) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffInSeconds / 31536000)}y ago`;
  };
  
  const relativeTime = getRelativeTime(post.created_at);
  const isEdited = post.updated_at && new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 5000;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) {
      setShowMenu(false);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      router.push('/feed');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[PostDetailClient] Error deleting post:', error);
      }
      alert('Failed to delete post');
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}` : '';

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      setShowMenu(false);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[PostDetailClient] Error copying to clipboard:', error);
      }
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    const shareData = {
      title: post.title || 'Check out this post on Love of Minnesota',
      text: post.content.slice(0, 100),
      url: shareUrl,
    };
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        handleCopyLink();
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[PostDetailClient] Share cancelled or failed:', error);
      }
    }
    setShowMenu(false);
  };


  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
            <Link
              href="/feed"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            <Link
              href="/feed"
              className="absolute left-1/2 transform -translate-x-1/2"
            >
              <Image
                src="/logo.png"
                alt="Love of Minnesota"
                width={32}
                height={32}
                className="w-8 h-8"
              />
            </Link>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
                aria-label="More options"
              >
                <EllipsisVerticalIcon className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 rounded-md shadow-lg z-10 min-w-[160px] bg-white border border-gray-200">
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <CheckIcon className="w-4 h-4 text-green-600" />
                        <span className="text-green-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ShareIcon className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                  {post.account?.username && (
                    <Link
                      href={`/profile/${post.account.username}`}
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <MapPinIcon className="w-4 h-4" />
                      <span>View Profile</span>
                    </Link>
                  )}
                  {post.map_data && (
                    <Link
                      href={`/live?lat=${post.map_data.lat}&lng=${post.map_data.lng}`}
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <MapPinIcon className="w-4 h-4" />
                      <span>View on Map</span>
                    </Link>
                  )}
                  {isOwner && (
                    <>
                      <div className="border-t border-gray-200 my-1" />
                      <Link
                        href={`/post/${post.id}/edit`}
                        onClick={() => setShowMenu(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                        <span>Edit</span>
                      </Link>
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <TrashIcon className="w-4 h-4" />
                        <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-[600px] mx-auto px-4 py-6">
          {/* Author Info */}
          {post.account && (
            <div className="flex items-center gap-3 mb-4">
              <Link href={`/profile/${username}`}>
                <ProfilePhoto 
                  account={post.account as unknown as Account} 
                  size="md" 
                  editable={false} 
                />
              </Link>
              <div className="flex-1">
                <Link 
                  href={`/profile/${username}`}
                  className="text-sm font-semibold text-gray-900 hover:opacity-80 transition-opacity"
                >
                  @{username}
                </Link>
              </div>
            </div>
          )}

          {/* Title */}
          {post.title && (
            <h1 className="text-2xl font-bold text-gray-900 mb-3">{post.title}</h1>
          )}

          {/* Content */}
          <div className="text-sm text-gray-900 whitespace-pre-wrap mb-4 leading-relaxed">
            {post.content}
          </div>

          {/* Images - Filter out map screenshot if it exists in map_data */}
          {post.images && post.images.length > 0 && (() => {
            // Filter out map screenshot from images if it exists in map_data
            const filteredImages = post.map_data?.screenshot
              ? post.images.filter(img => img.url !== post.map_data.screenshot)
              : post.images;
            
            if (filteredImages.length === 0) return null;
            
            return (
              <div className="mb-4 space-y-2">
                {filteredImages.map((image, index) => {
                  const isVideo = image.type === 'video';
                  return (
                    <div 
                      key={index} 
                      className="rounded-lg overflow-hidden border border-gray-200 relative group cursor-pointer"
                      onClick={() => !isVideo && setSelectedImageIndex(index)}
                    >
                      {isVideo ? (
                        <video
                          src={image.url}
                          controls
                          className="w-full h-auto"
                        />
                      ) : (
                        <>
                          <Image
                            src={image.url}
                            alt={image.alt || `Post image ${index + 1}`}
                            width={600}
                            height={400}
                            className="w-full h-auto object-cover"
                            unoptimized={image.url.startsWith('data:') || image.url.includes('supabase.co')}
                          />
                          {filteredImages.length > 1 && (
                            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                              {index + 1} / {filteredImages.length}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Image Modal */}
          {selectedImageIndex !== null && post.images && (() => {
            const filteredImages = post.map_data?.screenshot
              ? post.images.filter(img => img.url !== post.map_data.screenshot)
              : post.images;
            const image = filteredImages[selectedImageIndex];
            if (!image) return null;
            
            return (
              <div 
                className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                onClick={() => setSelectedImageIndex(null)}
              >
                <button
                  onClick={() => setSelectedImageIndex(null)}
                  className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {filteredImages.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex(selectedImageIndex > 0 ? selectedImageIndex - 1 : filteredImages.length - 1);
                      }}
                      className="absolute left-4 text-white hover:text-gray-300 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex(selectedImageIndex < filteredImages.length - 1 ? selectedImageIndex + 1 : 0);
                      }}
                      className="absolute right-4 text-white hover:text-gray-300 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
                <div onClick={(e) => e.stopPropagation()} className="max-w-4xl max-h-full">
                  <Image
                    src={image.url}
                    alt={image.alt || `Post image ${selectedImageIndex + 1}`}
                    width={1200}
                    height={800}
                    className="max-w-full max-h-[90vh] object-contain"
                    unoptimized={image.url.startsWith('data:') || image.url.includes('supabase.co')}
                  />
                </div>
              </div>
            );
          })()}

          {/* Map Data / Location */}
          {post.map_data && (
            <div className="mb-4">
              {post.map_data.screenshot && (
                <div className="mb-2 rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={post.map_data.screenshot}
                    alt="Map preview"
                    className="w-full h-auto"
                  />
                </div>
              )}
              <Link
                href={`/live?lat=${post.map_data.lat}&lng=${post.map_data.lng}&zoom=15`}
                className="block bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {post.map_data.place_name || post.map_data.address || 'Location'}
                    </div>
                    {post.map_data.address && post.map_data.place_name && (
                      <div className="text-xs text-gray-500">{post.map_data.address}</div>
                    )}
                    {post.map_data.type && (
                      <div className="text-xs text-gray-500 mt-1">
                        {post.map_data.type === 'area' ? 'Area' : post.map_data.type === 'pin' ? 'Pin' : 'Area & Pin'}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Mentions */}
          {post.mentions && post.mentions.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-xs font-medium text-gray-600 mb-2">Referenced Places:</div>
              {post.mentions.map((mention) => (
                <MentionCard key={mention.id} mention={mention} />
              ))}
            </div>
          )}

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-xs text-gray-500 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-1">
              <EyeIcon className="w-4 h-4" />
              <span>{viewCount} views</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{relativeTime}</span>
              {isEdited && (
                <span className="text-gray-400" title={`Edited on ${new Date(post.updated_at).toLocaleDateString()}`}>
                  • edited
                </span>
              )}
            </div>
            {post.mention_type && (
              <div className="flex items-center gap-1">
                <span>{post.mention_type.emoji}</span>
                <span>{post.mention_type.name}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              {post.visibility === 'public' ? (
                <GlobeAltIcon className="w-4 h-4" title="Public" />
              ) : (
                <LockClosedIcon className="w-4 h-4" title="Draft" />
              )}
            </div>
            {post.visibility === 'draft' && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                Draft
              </span>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
