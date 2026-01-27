'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPinIcon, EyeIcon, PencilIcon, TrashIcon, EllipsisVerticalIcon, ShareIcon, CheckIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { MentionService } from '../services/mentionService';
import { LikeService } from '../services/likeService';
import { useRouter } from 'next/navigation';
import { usePageView } from '@/hooks/usePageView';
import { useAuthStateSafe } from '@/features/auth';
import LikeButton from '@/components/mentions/LikeButton';

interface MentionDetailClientProps {
  mention: {
    id: string;
    lat: number;
    lng: number;
    description: string | null;
    visibility: 'public' | 'only_me';
    image_url: string | null;
    video_url: string | null;
    media_type: 'image' | 'video' | 'none' | null;
    full_address: string | null;
    view_count: number | null;
    likes_count?: number;
    is_liked?: boolean;
    created_at: string;
    updated_at: string;
    account_id: string | null;
    accounts?: {
      id: string;
      username: string | null;
      first_name: string | null;
      image_url: string | null;
      account_taggable?: boolean | null;
    } | null;
    mention_type?: {
      id: string;
      emoji: string;
      name: string;
    } | null;
    collection?: {
      id: string;
      emoji: string;
      title: string;
    } | null;
  };
  isOwner: boolean;
}

export default function MentionDetailClient({ mention, isOwner }: MentionDetailClientProps) {
  const { account } = useAuthStateSafe();
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewCount, setViewCount] = useState(mention.view_count || 0);
  const [likesCount, setLikesCount] = useState(mention.likes_count || 0);
  const [isLiked, setIsLiked] = useState(mention.is_liked || false);
  const [showMenu, setShowMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch likes data if not provided
  useEffect(() => {
    const fetchLikesData = async () => {
      if (!account?.id || mention.likes_count !== undefined) return;

      try {
        const [count, liked] = await Promise.all([
          LikeService.getLikeCount(mention.id),
          LikeService.hasLiked(mention.id, account.id),
        ]);
        setLikesCount(count);
        setIsLiked(liked);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[MentionDetailClient] Error fetching likes:', error);
        }
      }
    };

    fetchLikesData();
  }, [mention.id, account?.id, mention.likes_count]);

  // Track page view
  usePageView({ page_url: `/mention/${mention.id}` });

  // Optimistically increment view count on mount
  useEffect(() => {
    setViewCount(prev => prev + 1);
  }, []);

  const accountName = mention.accounts?.first_name || mention.accounts?.username || 'Anonymous';
  const createdDate = new Date(mention.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this mention?')) {
      setShowMenu(false);
      return;
    }

    setIsDeleting(true);
    try {
      await MentionService.deleteMention(mention.id);
      router.push('/');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[MentionDetailClient] Error deleting mention:', error);
      }
      alert('Failed to delete mention');
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

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

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/mention/${mention.id}` : '';

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      setShowMenu(false);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[MentionDetailClient] Error copying to clipboard:', error);
      }
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    const shareData = {
      title: 'Check out this mention on Love of Minnesota',
      text: mention.description || 'Check out this mention on the map!',
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
        console.debug('[MentionDetailClient] Share cancelled or failed:', error);
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
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Love of Minnesota"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="text-sm font-semibold text-gray-900">Love of Minnesota</span>
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
                  {mention.accounts?.username && (
                    <Link
                      href={`/profile/${mention.accounts.username}?mentionId=${mention.id}`}
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <MapPinIcon className="w-4 h-4" />
                      <span>View on Profile</span>
                    </Link>
                  )}
                  <Link
                    href={`/map/live?lat=${mention.lat}&lng=${mention.lng}`}
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <MapPinIcon className="w-4 h-4" />
                    <span>Live Map</span>
                  </Link>
                  {mention.accounts?.username && mention.accounts?.account_taggable && (
                    <Link
                      href={`/map/live?username=${encodeURIComponent(mention.accounts.username)}#contribute`}
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <UserPlusIcon className="w-4 h-4" />
                      <span>Tag User</span>
                    </Link>
                  )}
                  {isOwner && (
                    <>
                      <div className="border-t border-gray-200 my-1" />
                      <Link
                        href={`/mention/${mention.id}/edit`}
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
          {mention.accounts && (
            <div className="flex items-center gap-2 mb-4">
              {mention.accounts.image_url ? (
                <Image
                  src={mention.accounts.image_url}
                  alt={accountName}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover"
                  unoptimized={mention.accounts.image_url.includes('supabase.co')}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {accountName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{accountName}</div>
                {mention.accounts.username && (
                  <Link
                    href={`/profile/${mention.accounts.username}`}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    @{mention.accounts.username}
                  </Link>
                )}
              </div>
              {/* Labels: Mention Type and Collection */}
              <div className="flex items-center gap-2">
                {mention.mention_type && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
                    <span className="text-sm">{mention.mention_type.emoji}</span>
                    <span className="text-xs font-medium text-gray-700">{mention.mention_type.name}</span>
                  </div>
                )}
                {mention.collection && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 border border-blue-200">
                    <span className="text-sm">{mention.collection.emoji}</span>
                    <span className="text-xs font-medium text-blue-700">{mention.collection.title}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Media */}
          {mention.media_type === 'video' && mention.video_url && (
            <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 bg-black">
              <video
                src={mention.video_url}
                controls
                playsInline
                muted
                preload="metadata"
                className="w-full h-auto max-h-[600px] object-contain"
                onError={(e) => {
                  if (process.env.NODE_ENV === 'development') {
                    console.error('[MentionDetailClient] Video load error:', e);
                    const target = e.target as HTMLVideoElement;
                    if (target.error) {
                      console.error('[MentionDetailClient] Video error code:', target.error.code, 'Message:', target.error.message);
                      console.error('[MentionDetailClient] Video URL:', mention.video_url);
                    }
                  }
                }}
              />
            </div>
          )}
          {mention.media_type === 'image' && mention.image_url && (
            <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
              <Image
                src={mention.image_url}
                alt="Mention"
                width={600}
                height={400}
                className="w-full h-auto"
                unoptimized={mention.image_url.includes('supabase.co')}
              />
            </div>
          )}

          {/* Description */}
          {mention.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-900 leading-relaxed">{mention.description}</p>
            </div>
          )}


          {/* Location */}
          {mention.full_address && (
            <div className="mb-4 flex items-start gap-2 text-xs text-gray-600">
              <MapPinIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span>{mention.full_address}</span>
            </div>
          )}


          {/* Meta Info */}
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-1">
              <EyeIcon className="w-4 h-4" />
              <span>{viewCount} views</span>
            </div>
            {account && (
              <LikeButton
                mentionId={mention.id}
                initialLiked={isLiked}
                initialCount={likesCount}
                onLikeChange={(liked, count) => {
                  setIsLiked(liked);
                  setLikesCount(count);
                }}
                size="sm"
                showCount={true}
              />
            )}
            <div>
              <span>{createdDate}</span>
            </div>
          </div>

        </main>
      </div>
    </>
  );
}
