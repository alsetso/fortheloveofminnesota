'use client';

import { useEffect, useRef, useState } from 'react';
import { XMarkIcon, MapPinIcon, EllipsisVerticalIcon, PencilIcon, TrashIcon, EyeIcon, CameraIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { MentionService } from '@/features/mentions/services/mentionService';
import { findYouTubeUrls } from '@/features/mentions/utils/youtubeHelpers';
import YouTubePreview from '@/features/mentions/components/YouTubePreview';

interface MapEntityPopupProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'pin' | 'location' | null;
  data: {
    // Pin/Mention data
    id?: string;
    description?: string;
    image_url?: string | null;
    video_url?: string | null;
    media_type?: 'image' | 'video' | 'none';
    account_id?: string | null;
    account?: {
      username?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      image_url?: string | null;
      plan?: string | null;
    } | null;
    collection?: {
      id: string;
      emoji: string;
      title: string;
    } | null;
    created_at?: string;
    view_count?: number;
    // Location data
    place_name?: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  } | null;
}

/**
 * iOS-style popup that appears above mobile nav (z-[60])
 * Shows pin or location details
 */
export default function MapEntityPopup({ isOpen, onClose, type, data }: MapEntityPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAtMaxHeight, setIsAtMaxHeight] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  // Text color logic: white only when blur AND satellite, otherwise dark
  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';
  // Use transparent backgrounds and white text when satellite + blur
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when popup is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (popupRef.current) {
          popupRef.current.style.transform = 'translate(-50%, 0)';
        }
      });
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
      setIsAtMaxHeight(false);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, type]);

  // Check if content reaches max height
  useEffect(() => {
    if (!isOpen || !contentRef.current || !popupRef.current) return;

    const checkMaxHeight = () => {
      if (contentRef.current && popupRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const containerHeight = popupRef.current.clientHeight;
        const maxHeight = window.innerHeight - 64; // 4rem = 64px for mobile nav
        
        // Check if content is scrollable (reached max height)
        setIsAtMaxHeight(contentHeight >= maxHeight || contentRef.current.scrollHeight > contentRef.current.clientHeight);
      }
    };

    // Check immediately and after a short delay for content to render
    checkMaxHeight();
    const timeoutId = setTimeout(checkMaxHeight, 100);

    // Use ResizeObserver to watch for content changes
    const resizeObserver = new ResizeObserver(checkMaxHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [isOpen, data]);

  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.style.transform = 'translate(-50%, 100%)';
    }
    // Wait for animation to complete
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Check if current user owns this mention
  const isOwner = type === 'pin' && user && account && data && data.account_id === account.id;

  // Initialize edit description when editing starts
  useEffect(() => {
    if (isEditing && data && data.description) {
      setEditDescription(data.description);
    }
  }, [isEditing, data]);

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

  const handleEdit = () => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    if (!data || !data.id) return;
    
    setIsSaving(true);
    try {
      await MentionService.updateMention(data.id, {
        description: editDescription.trim() || null,
      });
      
      // Update local data
      if (data) {
        data.description = editDescription.trim() || undefined;
      }
      
      // Dispatch event to refresh mentions
      window.dispatchEvent(new CustomEvent('mention-archived'));
      
      setIsEditing(false);
      setEditDescription('');
    } catch (err) {
      console.error('[MapEntityPopup] Error updating mention:', err);
      alert('Failed to update mention. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditDescription('');
  };

  const handleDelete = async () => {
    if (!data || !data.id) return;
    
    if (!confirm('Are you sure you want to delete this mention?')) {
      setShowMenu(false);
      return;
    }

    setIsDeleting(true);
    try {
      await MentionService.updateMention(data.id, {
        archived: true,
      });
      
      // Dispatch event to refresh mentions
      window.dispatchEvent(new CustomEvent('mention-archived'));
      
      // Close popup
      handleClose();
    } catch (err) {
      console.error('[MapEntityPopup] Error deleting mention:', err);
      alert('Failed to delete mention. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!data || !data.id) return;
    
    if (!confirm('Are you sure you want to remove the image from this mention?')) {
      return;
    }

    setIsSaving(true);
    try {
      await MentionService.updateMention(data.id, {
        image_url: null,
        video_url: null,
        media_type: 'none',
      });
      
      // Update local data
      if (data) {
        data.image_url = null;
        data.video_url = null;
        data.media_type = 'none';
      }
      
      // Dispatch event to refresh mentions
      window.dispatchEvent(new CustomEvent('mention-archived'));
    } catch (err) {
      console.error('[MapEntityPopup] Error removing image:', err);
      alert('Failed to remove image. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !data) return null;

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      // Less than 1 minute
      if (diffSeconds < 60) {
        return 'just now';
      }
      
      // Less than 1 hour - show minutes
      if (diffMinutes < 60) {
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
      }
      
      // Less than 24 hours - show hours
      if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      }
      
      // 1 or more days - show days and hours
      const remainingHours = diffHours % 24;
      if (diffDays === 1) {
        if (remainingHours === 0) {
          return '1 day ago';
        }
        return `1 day and ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'} ago`;
      }
      
      if (diffDays < 7) {
        if (remainingHours === 0) {
          return `${diffDays} days ago`;
        }
        return `${diffDays} days and ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'} ago`;
      }
      
      // More than a week - show date
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 xl:hidden"
        onClick={handleClose}
      />
      
      {/* Popup - iOS-style bottom sheet */}
      <div
        ref={popupRef}
        className={`fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-3xl
          xl:rounded-t-lg xl:rounded-b-none xl:max-h-[50vh]
          ${useBlurStyle ? 'bg-transparent backdrop-blur-md' : 'bg-white'}`}
        style={{
          transform: 'translate(-50%, 100%)',
          maxWidth: '600px',
          width: 'calc(100% - 2rem)',
          minHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'auto' : '40vh',
          maxHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '50vh' : '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar - hidden on desktop */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0 xl:hidden">
          <div className={`w-12 h-1 rounded-full ${useBlurStyle ? 'bg-white/40' : 'bg-gray-300'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          useBlurStyle 
            ? 'border-transparent' 
            : 'border-gray-200'
        }`}>
          {/* Account info on left - only for pin/mention type */}
          {type === 'pin' && data.account ? (
            <>
              {user && data.account.username ? (
                // Authenticated with username: clickable link
                <Link
                  href={`/profile/${encodeURIComponent(data.account.username)}`}
                  onClick={onClose}
                  className="flex items-center gap-2"
                >
                  {/* Profile image */}
                  <div className={`w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ${
                    (data.account.plan === 'pro' || data.account.plan === 'plus')
                      ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                      : 'border border-gray-200'
                  }`}>
                    <div className="w-full h-full rounded-full overflow-hidden bg-white">
                      {data.account.image_url ? (
                        <Image
                          src={data.account.image_url}
                          alt={data.account.username || 'User'}
                          width={28}
                          height={28}
                          className="w-full h-full rounded-full object-cover"
                          unoptimized={data.account.image_url.startsWith('data:') || data.account.image_url.includes('supabase.co')}
                        />
                      ) : (
                        <div className="w-full h-full rounded-full flex items-center justify-center bg-gray-100">
                          <span className="text-[10px] font-medium text-gray-600">
                            {data.account.username?.[0]?.toUpperCase() || data.account.first_name?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Username */}
                  <span className={`text-xs font-medium truncate ${
                    useWhiteText ? 'text-white' : 'text-gray-900'
                  }`}>
                    {data.account.username}
                  </span>
                </Link>
              ) : user ? (
                // Authenticated without username: non-clickable
                <div className="flex items-center gap-2">
                  {/* Profile image */}
                  <div className={`w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ${
                    (data.account.plan === 'pro' || data.account.plan === 'plus')
                      ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                      : 'border border-gray-200'
                  }`}>
                    <div className="w-full h-full rounded-full overflow-hidden bg-white">
                      {data.account.image_url ? (
                        <Image
                          src={data.account.image_url}
                          alt="User"
                          width={28}
                          height={28}
                          className="w-full h-full rounded-full object-cover"
                          unoptimized={data.account.image_url.startsWith('data:') || data.account.image_url.includes('supabase.co')}
                        />
                      ) : (
                        <div className="w-full h-full rounded-full flex items-center justify-center bg-gray-100">
                          <span className="text-[10px] font-medium text-gray-600">
                            {data.account.first_name?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Name */}
                  <span className={`text-xs font-medium truncate ${
                    useWhiteText ? 'text-white' : 'text-gray-900'
                  }`}>
                    {`${data.account.first_name || ''} ${data.account.last_name || ''}`.trim() || 'User'}
                  </span>
                </div>
              ) : (
                // Unauthenticated: sign in button
                <button
                  onClick={openWelcome}
                  className={`flex items-center gap-2 transition-colors ${
                    useWhiteText
                      ? 'text-white/80 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-medium text-gray-500">?</span>
                  </div>
                  <span className="text-xs font-medium">Sign in to see who posted</span>
                </button>
              )}
            </>
          ) : (
            <h2 className={`text-sm font-semibold ${
              useWhiteText 
                ? 'text-white' 
                : 'text-gray-900'
            }`}>
              {type === 'location' ? 'Location' : ''}
            </h2>
          )}
          <div className="flex items-center gap-0.5">
            {/* Three dots menu - only show for owner's mentions */}
            {isOwner && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={`p-1 transition-colors ${
                    useWhiteText 
                      ? 'text-white/80 hover:text-white' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  aria-label="More options"
                  disabled={isDeleting}
                >
                  <EllipsisVerticalIcon className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className={`absolute right-0 top-full mt-1 rounded-md shadow-lg z-10 min-w-[120px] ${
                    useTransparentUI
                      ? 'bg-white/90 backdrop-blur-md border border-white/20'
                      : 'bg-white border border-gray-200'
                  }`}>
                    <button
                      onClick={handleEdit}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        useTransparentUI
                          ? 'text-white hover:bg-white/20'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      disabled={isEditing || isSaving}
                    >
                      <PencilIcon className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={handleDelete}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        useTransparentUI
                          ? 'text-red-300 hover:bg-red-500/20'
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                      disabled={isDeleting}
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleClose}
              className={`p-1 -mr-1 transition-colors ${
                useWhiteText 
                  ? 'text-gray-300 hover:text-white' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Always scrollable on desktop */}
        <div ref={contentRef} className="flex-1 overflow-y-auto xl:overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Pin/Mention Content */}
            {type === 'pin' && (
              <>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-md focus:outline-none focus:ring-1 resize-none ${
                        useTransparentUI
                          ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:ring-white'
                          : 'text-gray-900 border border-gray-200 focus:ring-indigo-500'
                      }`}
                      rows={3}
                      maxLength={240}
                      disabled={isSaving}
                      autoFocus
                    />
                    
                    {/* Image Management within Edit */}
                    {(data.image_url || data.video_url) ? (
                      <div className="relative w-full rounded-md overflow-hidden border border-gray-200 bg-black">
                        {data.video_url ? (
                          <video
                            src={data.video_url}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full h-auto max-h-64 object-contain"
                          />
                        ) : data.image_url ? (
                          <Image
                            src={data.image_url}
                            alt="Mention media"
                            width={400}
                            height={300}
                            className="w-full h-auto object-cover"
                            unoptimized={data.image_url.includes('supabase.co')}
                          />
                        ) : null}
                        {/* Remove image button - X in top right */}
                        <button
                          onClick={handleRemoveImage}
                          disabled={isSaving}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center transition-colors"
                          aria-label="Remove image"
                        >
                          <XMarkIcon className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          // Trigger file input or camera - placeholder for now
                          alert('Image upload functionality coming soon. Use the create flow to add images.');
                        }}
                        disabled={isSaving}
                        className={`w-full py-8 rounded-md border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 ${
                          useTransparentUI
                            ? 'border-white/30 hover:border-white/50 hover:bg-white/10'
                            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        <CameraIcon className={`w-8 h-8 ${useWhiteText ? 'text-white/70' : 'text-gray-400'}`} />
                        <span className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                          Add image or video
                        </span>
                      </button>
                    )}
                    
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          useTransparentUI
                            ? 'text-white bg-white/10 border border-white/20 hover:bg-white/20'
                            : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
                        }`}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                    <div className="space-y-2">
                    {data.description ? (
                      <>
                      {/* Description text with clickable YouTube links */}
                      <div className={`text-xs ${useWhiteText ? 'text-white/90' : 'text-gray-700'}`}>
                        {(() => {
                            // For non-authenticated users: truncate to 90 characters
                            const description = data.description || '';
                            const shouldTruncate = !user && description.length > 90;
                            const displayDescription = shouldTruncate 
                              ? description.substring(0, 90) 
                              : description;

                          const youtubeUrls = findYouTubeUrls(displayDescription);
                          if (youtubeUrls.length === 0) {
                            return (
                              <>
                                <span>{displayDescription}</span>
                                {shouldTruncate && (
                                  <>
                                    <span>...</span>
                                    <button
                                      onClick={openWelcome}
                                      className={`ml-1 underline transition-colors ${
                                        useWhiteText
                                          ? 'text-white hover:text-white/80'
                                          : 'text-blue-600 hover:text-blue-700'
                                      }`}
                                    >
                                      (sign in)
                                    </button>
                                  </>
                                )}
                              </>
                            );
                          }

                          // Split description by YouTube URLs and render with links
                          const parts: Array<{ text: string; isUrl: boolean; url?: string }> = [];
                          let lastIndex = 0;

                          youtubeUrls.forEach((youtubeData) => {
                            // Add text before URL
                            if (youtubeData.startIndex > lastIndex) {
                              parts.push({
                                text: displayDescription.substring(lastIndex, youtubeData.startIndex),
                                isUrl: false,
                              });
                            }
                            // Add URL
                            parts.push({
                              text: youtubeData.url,
                              isUrl: true,
                              url: youtubeData.url,
                            });
                            lastIndex = youtubeData.endIndex;
                          });

                          // Add remaining text
                          if (lastIndex < displayDescription.length) {
                            parts.push({
                              text: displayDescription.substring(lastIndex),
                              isUrl: false,
                            });
                          }

                          return (
                            <>
                              {parts.map((part, index) => {
                                if (part.isUrl && part.url) {
                                  return (
                                    <a
                                      key={index}
                                      href={part.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`underline transition-colors ${
                                        useWhiteText
                                          ? 'text-white hover:text-white/80'
                                          : 'text-blue-600 hover:text-blue-700'
                                      }`}
                                    >
                                      {part.text}
                                    </a>
                                  );
                                }
                                return <span key={index}>{part.text}</span>;
                              })}
                              {shouldTruncate && (
                                <>
                                  <span>...</span>
                                  <button
                                    onClick={openWelcome}
                                    className={`ml-1 underline transition-colors ${
                                      useWhiteText
                                        ? 'text-white hover:text-white/80'
                                        : 'text-blue-600 hover:text-blue-700'
                                    }`}
                                  >
                                    (sign in)
                                  </button>
                                </>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      
                      {/* Mention Media (Image or Video) */}
                      {(data.image_url || data.video_url) && (
                        <div className="relative w-full rounded-md overflow-hidden border border-gray-200 mt-2 bg-black">
                          {data.video_url ? (
                            <video
                              key={data.video_url}
                              src={data.video_url}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full h-auto max-h-64 object-contain"
                              onError={(e) => {
                                console.error('[MapEntityPopup] Video load error:', e);
                                const target = e.target as HTMLVideoElement;
                                if (target.error) {
                                  console.error('[MapEntityPopup] Video error code:', target.error.code, 'Message:', target.error.message);
                                  console.error('[MapEntityPopup] Video URL:', data.video_url);
                                }
                              }}
                            />
                          ) : data.image_url ? (
                            <Image
                              src={data.image_url}
                              alt="Mention image"
                              width={400}
                              height={300}
                              className="w-full h-auto object-cover"
                              unoptimized={data.image_url.includes('supabase.co')}
                            />
                          ) : null}
                        </div>
                      )}
                      
                      {/* YouTube Previews - only show for authenticated users */}
                      {user && (() => {
                        const description = data.description || '';
                        const youtubeUrls = findYouTubeUrls(description);
                        if (youtubeUrls.length === 0) return null;
                        
                        return (
                          <div className="space-y-2">
                            {youtubeUrls.map((youtubeData, index) => (
                              <YouTubePreview
                                key={index}
                                url={youtubeData.url}
                                compact={false}
                                useTransparentUI={useTransparentUI}
                              />
                            ))}
                          </div>
                        );
                      })()}
                      </>
                    ) : (
                      <div className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                        No description available
                      </div>
                    )}
                    </div>
                )}
                {/* View count and timestamp row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {data.view_count !== undefined && data.view_count > 0 && (
                      <div className={`flex items-center gap-1 text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                        <EyeIcon className="w-3 h-3" />
                        <span>{data.view_count.toLocaleString()}</span>
                      </div>
                    )}
                    {data.collection && (
                      <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                        useWhiteText ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span>{data.collection.emoji}</span>
                        <span>{data.collection.title}</span>
                      </div>
                    )}
                  </div>
                  {data.created_at && (
                    <div className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                      {formatTimeAgo(data.created_at)}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Location Content */}
            {type === 'location' && (
              <>
                <div className="flex items-start gap-2">
                  <MapPinIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    useWhiteText ? 'text-white/60' : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    {data.place_name && (
                      <div className={`text-xs font-medium ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                        {data.place_name}
                      </div>
                    )}
                    {data.address && (
                      <div className={`text-xs mt-0.5 ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                        {data.address}
                      </div>
                    )}
                    {data.coordinates && (
                      <div className={`text-xs mt-1 ${useWhiteText ? 'text-white/50' : 'text-gray-400'}`}>
                        {data.coordinates.lat.toFixed(6)}, {data.coordinates.lng.toFixed(6)}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Save/Add Label Button */}
                {data.coordinates && (
                  <>
                    {MinnesotaBoundsService.isWithinMinnesota(data.coordinates) ? (
                      <button
                        onClick={() => {
                          // Dispatch event to show location for mention creation
                          window.dispatchEvent(new CustomEvent('show-location-for-mention', {
                            detail: { 
                              lat: data.coordinates!.lat, 
                              lng: data.coordinates!.lng 
                            }
                          }));
                          handleClose();
                        }}
                        className={`mt-4 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          useTransparentUI
                            ? 'text-white bg-white/10 border border-white/20 hover:bg-white/20'
                            : 'text-gray-900 bg-white border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        Add Mention
                      </button>
                    ) : (
                      <div className={`w-full mt-4 px-4 py-2.5 text-xs rounded-md text-center ${
                        useTransparentUI
                          ? 'text-white/80 bg-white/10'
                          : 'text-gray-600 bg-gray-100'
                      }`}>
                        Location outside Minnesota
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

