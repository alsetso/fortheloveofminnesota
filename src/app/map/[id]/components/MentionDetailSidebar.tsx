'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPinIcon, PencilIcon, TrashIcon, EllipsisVerticalIcon, ShareIcon, CheckIcon, EyeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
// Note: Mentions are now map_pins - using map_pins API
import type { Mention } from '@/types/mention';

interface MentionDetailSidebarProps {
  mention: Mention;
  isOwner: boolean;
  permissionsLoading?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  mapId?: string; // Map ID for delete API call
}

export default function MentionDetailSidebar({ mention, isOwner, permissionsLoading = false, onClose, onDeleted, mapId }: MentionDetailSidebarProps) {
  const { account } = useAuthStateSafe();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewCount, setViewCount] = useState(mention.view_count || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  

  // Optimistically increment view count on mount
  useEffect(() => {
    setViewCount(prev => prev + 1);
  }, []);

  const accountName = mention.account?.username || 'Anonymous';
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
      // Use map_pins API (mentions are now map_pins)
      if (!mapId) {
        throw new Error('Map ID required');
      }
      const response = await fetch(`/api/maps/${mapId}/pins/${mention.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      onDeleted?.();
      onClose();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[MentionDetailSidebar] Error deleting pin:', error);
      }
      alert('Failed to delete pin');
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
        console.error('[MentionDetailSidebar] Error copying to clipboard:', error);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-[10px] border-b border-gray-200 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Mention Details</h2>
        <div className="flex items-center gap-2">
          {!permissionsLoading && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
                aria-label="More options"
              >
                <EllipsisVerticalIcon className="w-4 h-4" />
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
                        <ShareIcon className="w-4 h-4" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
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
          )}
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-[10px] py-3 space-y-3">
        {/* Account Info - At Top */}
        {mention.account && (
          <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
            <ProfilePhoto
              account={{
                id: mention.account.id,
                username: mention.account.username,
                image_url: mention.account.image_url,
              } as any}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-900 truncate">{accountName}</div>
              {mention.account.username && (
                <Link
                  href={`/${mention.account.username}`}
                  className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
                >
                  @{mention.account.username}
                </Link>
              )}
              {mention.account.plan && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Plan: {mention.account.plan}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MVP: Essential Pin Details - Always Visible */}
        <div className="space-y-3">
          {/* Description/Caption - Always show (even if empty) */}
          <div>
            <p className="text-xs text-gray-900 leading-relaxed">
              {mention.description || <span className="text-gray-400">No description</span>}
            </p>
          </div>

          {/* Location - Always show address or coordinates */}
          <div>
            {mention.full_address ? (
              <div className="flex items-start gap-2 text-[10px] text-gray-600">
                <MapPinIcon className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>{mention.full_address}</span>
              </div>
            ) : (
              <div>
                <div className="text-[10px] font-medium text-gray-500 mb-0.5">Location</div>
                <div className="text-xs text-gray-900">
                  {mention.lat.toFixed(6)}, {mention.lng.toFixed(6)}
                </div>
              </div>
            )}
          </div>

          {/* Collection & Mention Type - Always show section */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {mention.collection ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200">
                <span className="text-xs">{mention.collection.emoji}</span>
                <span className="text-[10px] font-medium text-blue-700">{mention.collection.title}</span>
              </div>
            ) : null}
            {mention.mention_type ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-50 border border-gray-200">
                <span className="text-xs">{mention.mention_type.emoji}</span>
                <span className="text-[10px] font-medium text-gray-700">{mention.mention_type.name}</span>
              </div>
            ) : null}
          </div>

          {/* Created Date - Always show */}
          <div className="text-[10px] text-gray-500">
            Created {createdDate}
          </div>

          {/* View Count - Always show */}
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <EyeIcon className="w-3 h-3" />
            <span>{viewCount} views</span>
          </div>
        </div>

        {/* Media Preview */}
        {mention.media_type === 'video' && mention.video_url && (
          <div className="rounded-md overflow-hidden border border-gray-200 bg-black">
            <video
              src={mention.video_url}
              controls
              playsInline
              muted
              preload="metadata"
              className="w-full h-auto max-h-[300px] object-contain"
            />
          </div>
        )}
        {mention.media_type === 'image' && mention.image_url && (
          <div className="rounded-md overflow-hidden border border-gray-200">
            <Image
              src={mention.image_url}
              alt="Mention"
              width={400}
              height={300}
              className="w-full h-auto"
              unoptimized={mention.image_url.includes('supabase.co')}
            />
          </div>
        )}

      </div>
    </div>
  );
}
