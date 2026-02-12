'use client';

import { useEffect, useRef, useState } from 'react';
import { XMarkIcon, MapPinIcon, EllipsisVerticalIcon, EyeIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import { useAuthStateSafe, Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { MentionService } from '@/features/mentions/services/mentionService';
import { findYouTubeUrls } from '@/features/mentions/utils/youtubeHelpers';
import YouTubePreview from '@/features/mentions/components/YouTubePreview';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import type { Mention } from '@/types/mention';

interface MapEntityPopupProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'pin' | 'location' | null;
  /** Callback when a nearby mention is clicked - updates URL and switches to mention view */
  onMentionSelect?: (mentionId: string, lat: number, lng: number) => void;
  /** When true, positions popup within NewPageWrapper center column instead of fixed to viewport */
  inMapContainer?: boolean;
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
    mention_type?: {
      id: string;
      emoji: string;
      name: string;
    } | null;
    created_at?: string;
    view_count?: number;
    likes_count?: number;
    is_liked?: boolean;
    map_meta?: Record<string, any> | null;
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
export default function MapEntityPopup({ isOpen, onClose, type, data, onMentionSelect, inMapContainer = false }: MapEntityPopupProps) {
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAtMaxHeight, setIsAtMaxHeight] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [nearbyMentions, setNearbyMentions] = useState<Mention[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });
  const [showMapMetaInfo, setShowMapMetaInfo] = useState(false);
  const mapMetaInfoRef = useRef<HTMLDivElement>(null);

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

  // Close map meta info popup when clicking outside
  useEffect(() => {
    if (!showMapMetaInfo) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (mapMetaInfoRef.current && !mapMetaInfoRef.current.contains(event.target as Node)) {
        setShowMapMetaInfo(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMapMetaInfo]);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when popup is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (popupRef.current) {
          // Low position: when inMapContainer, start at 70% (showing 30% of popup)
          // Otherwise, animate to bottom (0)
          const translateY = inMapContainer ? '70%' : '0';
          popupRef.current.style.transform = `translate(-50%, ${translateY})`;
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
  }, [isOpen, type, inMapContainer]);

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
      // Animate back to off-screen position before closing
      // When in map container, animate back to low position (70% down) then off screen
      const translateY = inMapContainer ? '100%' : '100%';
      popupRef.current.style.transform = `translate(-50%, ${translateY})`;
    }
    // Wait for animation to complete
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Check if current user owns this mention
  const isOwner = type === 'pin' && user && account && data && data.account_id === account.id;


  // Fetch nearby mentions when popup opens with location data
  useEffect(() => {
    if (!isOpen || type !== 'location' || !data?.coordinates) {
      setNearbyMentions([]);
      return;
    }

    const fetchNearbyMentions = async () => {
      setIsLoadingNearby(true);
      try {
        const lat = data.coordinates!.lat;
        const lng = data.coordinates!.lng;
        const radius = 0.5; // 500 meters
        
        const latDelta = radius / 111;
        const lngDelta = radius / 78;
        
        const bbox = {
          minLat: lat - latDelta,
          maxLat: lat + latDelta,
          minLng: lng - lngDelta,
          maxLng: lng + lngDelta,
        };
        
        const fetchedMentions = await MentionService.getMentions({ bbox });
        
        // Sort by distance
        const sortedMentions = fetchedMentions.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.lat - lat, 2) + Math.pow(a.lng - lng, 2));
          const distB = Math.sqrt(Math.pow(b.lat - lat, 2) + Math.pow(b.lng - lng, 2));
          return distA - distB;
        });
        
        setNearbyMentions(sortedMentions.slice(0, 5)); // Limit to 5 nearby
      } catch (err) {
        console.error('Error fetching nearby mentions:', err);
        setNearbyMentions([]);
      } finally {
        setIsLoadingNearby(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchNearbyMentions();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [isOpen, type, data?.coordinates]);

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
        className={`${inMapContainer ? 'absolute' : 'fixed'} z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          ${inMapContainer ? 'bottom-0 left-1/2' : 'bottom-0 left-1/2'} -translate-x-1/2 rounded-t-3xl
          xl:rounded-t-lg xl:rounded-b-none xl:max-h-[50vh]
          ${useBlurStyle ? 'bg-transparent backdrop-blur-md' : 'bg-white'}`}
        style={{
          transform: inMapContainer ? 'translate(-50%, 70%)' : 'translate(-50%, 100%)',
          maxWidth: inMapContainer ? 'calc(100% - 2rem)' : '600px',
          width: inMapContainer ? 'calc(100% - 2rem)' : 'calc(100% - 2rem)',
          minHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'auto' : '40vh',
          maxHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '50vh' : '80vh',
          paddingBottom: inMapContainer ? '0' : 'env(safe-area-inset-bottom)',
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
                  href={`/${encodeURIComponent(data.account.username)}`}
                  onClick={onClose}
                  className="flex items-center gap-2"
                >
                  {/* Profile image */}
                  <ProfilePhoto 
                    account={data.account as unknown as Account} 
                    size="xs" 
                    editable={false} 
                  />
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
                  <ProfilePhoto 
                    account={data.account as unknown as Account} 
                    size="xs" 
                    editable={false} 
                  />
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
            {/* Three dots menu - show for all mentions */}
            {type === 'pin' && data && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={`p-1 transition-colors ${
                    useWhiteText 
                      ? 'text-white/80 hover:text-white' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  aria-label="More options"
                >
                  <EllipsisVerticalIcon className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className={`absolute right-0 top-full mt-1 rounded-md shadow-lg z-10 min-w-[140px] ${
                    useTransparentUI
                      ? 'bg-white/90 backdrop-blur-md border border-white/20'
                      : 'bg-white border border-gray-200'
                  }`}>
                    {data?.id && (
                      <Link
                        href={`/mention/${data.id}`}
                        onClick={() => setShowMenu(false)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                          useTransparentUI
                            ? 'text-white hover:bg-white/20'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <EyeIcon className="w-4 h-4" />
                        <span>More</span>
                      </Link>
                    )}
                    {data?.account?.username && (
                      <Link
                        href={`/${encodeURIComponent(data.account.username)}`}
                        onClick={() => setShowMenu(false)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                          useTransparentUI
                            ? 'text-white hover:bg-white/20'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>View Profile</span>
                      </Link>
                    )}
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
                    <div className="space-y-2">
                      {/* Map Metadata Label - Public, visible to all users */}
                      {data.map_meta && data.map_meta.feature && (() => {
                        const feature = data.map_meta.feature;
                        const props = feature.properties || {};
                        
                        // Determine display label - prefer name, fallback to type/class/layerId
                        let displayName = feature.name || 'Map Feature';
                        if (!feature.name) {
                          if (props.type) {
                            displayName = String(props.type);
                          } else if (props.class) {
                            displayName = String(props.class).replace(/_/g, ' ');
                          } else if (feature.layerId) {
                            // Parse layerId for common patterns
                            const layerId = feature.layerId.toLowerCase();
                            if (layerId.includes('poi')) displayName = 'Point of Interest';
                            else if (layerId.includes('building')) displayName = 'Building';
                            else if (layerId.includes('road') || layerId.includes('highway')) displayName = 'Road';
                            else if (layerId.includes('water')) displayName = 'Water';
                            else if (layerId.includes('landuse')) displayName = 'Land Use';
                            else if (layerId.includes('place')) displayName = 'Place';
                            else displayName = feature.layerId.replace(/-/g, ' ').replace(/_/g, ' ');
                          }
                        }
                        
                        // Determine category label - prefer category, fallback to type/class
                        let categoryLabel = feature.category && feature.category !== 'unknown' 
                          ? feature.category.replace(/_/g, ' ')
                          : null;
                        
                        if (!categoryLabel || categoryLabel === 'unknown') {
                          if (props.type) {
                            categoryLabel = String(props.type).replace(/_/g, ' ');
                          } else if (props.class) {
                            categoryLabel = String(props.class).replace(/_/g, ' ');
                          } else if (feature.sourceLayer) {
                            categoryLabel = feature.sourceLayer.replace(/_/g, ' ');
                          } else if (feature.layerId) {
                            const layerId = feature.layerId.toLowerCase();
                            if (layerId.includes('poi')) categoryLabel = 'Point of Interest';
                            else if (layerId.includes('building')) categoryLabel = 'Building';
                            else if (layerId.includes('road') || layerId.includes('highway')) categoryLabel = 'Road';
                            else if (layerId.includes('water')) categoryLabel = 'Water';
                            else categoryLabel = feature.layerId.replace(/-/g, ' ').replace(/_/g, ' ');
                          }
                        }
                        
                        // Combine displayName and categoryLabel into single line
                        const singleLineLabel = categoryLabel && categoryLabel !== displayName
                          ? `${displayName} • ${categoryLabel}`
                          : displayName;

                        return (
                          <div className="relative">
                            <div className={`flex items-center gap-2 p-2 border rounded-md ${
                              useTransparentUI
                                ? 'bg-white/10 border-white/20'
                                : 'bg-gray-50 border-gray-200'
                            }`}>
                              {feature.icon && feature.icon !== '📍' && (
                                <span className="text-xs flex-shrink-0">{feature.icon}</span>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-semibold truncate ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                                  {singleLineLabel}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMapMetaInfo(!showMapMetaInfo);
                                }}
                                className={`flex-shrink-0 p-0.5 transition-colors ${
                                  useTransparentUI
                                    ? 'text-white/60 hover:text-white'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                                aria-label="Map metadata information"
                              >
                                <InformationCircleIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            {/* Info Popup */}
                            {showMapMetaInfo && (
                              <div
                                ref={mapMetaInfoRef}
                                className={`absolute top-full left-0 right-0 mt-1 z-50 border rounded-md shadow-lg p-2 ${
                                  useTransparentUI
                                    ? 'bg-white/90 backdrop-blur-md border-white/20'
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <p className={`text-xs ${useTransparentUI ? 'text-white/90' : 'text-gray-600'}`}>
                                  This is map data from where this mention was created. It helps provide context about the location.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Mention Type Label - Above Description - Clickable */}
                      {(() => {
                        // Debug: Log mention_type data
                        if (process.env.NODE_ENV === 'development') {
                          console.log('[MapEntityPopup] Rendering mention type:', {
                            mention_type: data.mention_type,
                            has_mention_type: !!data.mention_type,
                            type: typeof data.mention_type,
                          });
                        }
                        return data.mention_type ? (
                          <button
                            onClick={() => {
                              const typeSlug = mentionTypeNameToSlug(data.mention_type!.name);
                              // Close popup first
                              handleClose();
                              // Navigate to /maps with type filter
                              router.push(`/maps?type=${typeSlug}`);
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                              useWhiteText 
                                ? 'bg-white/10 text-white/70 hover:bg-white/20' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <span className="text-sm">{data.mention_type.emoji}</span>
                            <span className="text-xs font-medium">{data.mention_type.name}</span>
                          </button>
                        ) : null;
                      })()}
                    {data.description ? (
                      <>
                      {/* Description text with clickable YouTube links - Large, Dark, Bold */}
                      <div className={`text-base font-bold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
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
                      {(data.media_type === 'video' && data.video_url) || (data.media_type === 'image' && data.image_url) ? (
                        <div className="relative w-full aspect-video rounded-md overflow-hidden border border-gray-200 mt-2 bg-black">
                          {data.media_type === 'video' && data.video_url ? (
                            <video
                              key={data.video_url}
                              src={data.video_url}
                              controls
                              playsInline
                              muted
                              preload="metadata"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                console.error('[MapEntityPopup] Video load error:', e);
                                const target = e.target as HTMLVideoElement;
                                if (target.error) {
                                  console.error('[MapEntityPopup] Video error code:', target.error.code, 'Message:', target.error.message);
                                  console.error('[MapEntityPopup] Video URL:', data.video_url);
                                }
                              }}
                              onLoadedMetadata={() => {
                                // Video metadata loaded successfully
                                console.debug('[MapEntityPopup] Video metadata loaded:', data.video_url);
                              }}
                            />
                          ) : data.media_type === 'image' && data.image_url ? (
                            <Image
                              src={data.image_url}
                              alt="Mention image"
                              fill
                              className="object-cover"
                              unoptimized={data.image_url.includes('supabase.co')}
                            />
                          ) : null}
                        </div>
                      ) : null}
                      
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
                {/* View count and timestamp row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {data.view_count !== undefined && data.view_count > 0 && (
                      <div className={`flex items-center gap-1 text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                        <EyeIcon className="w-3 h-3" />
                        <span>{data.view_count.toLocaleString()}</span>
                      </div>
                    )}
                    {/* Collection Label */}
                    {data.collection && (
                      <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                        useWhiteText ? 'bg-white/10 text-white/70' : 'bg-blue-100 text-blue-700'
                      }`}>
                        <span>{data.collection.emoji}</span>
                        <span>{data.collection.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {data.created_at && (
                      <div className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                        {formatTimeAgo(data.created_at)}
                      </div>
                    )}
                  </div>
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

                {/* Nearby Mentions - Only for location type */}
                {type === 'location' && data.coordinates && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPinIcon className="w-3.5 h-3.5 text-gray-600" />
                      <h3 className={`text-xs font-medium ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                        Nearby Mentions
                      </h3>
                      {nearbyMentions.length > 0 && (
                        <span className={`text-[10px] ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                          ({nearbyMentions.length})
                        </span>
                      )}
                    </div>

                    {isLoadingNearby ? (
                      <div className="flex items-center justify-center py-4">
                        <div className={`w-4 h-4 border-2 ${useWhiteText ? 'border-white/30 border-t-white' : 'border-gray-300 border-t-gray-600'} rounded-full animate-spin`} />
                      </div>
                    ) : nearbyMentions.length > 0 ? (
                      <div className="space-y-2">
                        {nearbyMentions.map((mention) => {
                          const truncatedDescription = mention.description
                            ? mention.description.length > 45
                              ? mention.description.substring(0, 45) + '...'
                              : mention.description
                            : 'No description';
                          
                          return (
                            <button
                              key={mention.id}
                              onClick={() => {
                                if (onMentionSelect) {
                                  onMentionSelect(mention.id, mention.lat, mention.lng);
                                  handleClose();
                                } else {
                                  // Fallback: navigate directly
                                  handleClose();
                                  router.push(`/map/live?lat=${mention.lat}&lng=${mention.lng}&mentionId=${mention.id}`);
                                }
                              }}
                              className={`w-full text-left block rounded-md p-[10px] transition-colors ${
                                useTransparentUI
                                  ? 'bg-white/10 border border-white/20 hover:bg-white/20'
                                  : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {mention.mention_type && (
                                  <div className={`flex-shrink-0 text-sm leading-none mt-0.5 ${useWhiteText ? 'text-white/90' : 'text-gray-600'}`}>
                                    {mention.mention_type.emoji}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  {mention.mention_type && (
                                    <div className={`text-xs font-medium mb-0.5 ${useWhiteText ? 'text-white/90' : 'text-gray-600'}`}>
                                      {mention.mention_type.name}
                                    </div>
                                  )}
                                  <p className={`text-xs line-clamp-2 ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                                    {truncatedDescription}
                                  </p>
                                </div>
                                {mention.image_url && (
                                  <div className="flex-shrink-0">
                                    <img
                                      src={mention.image_url}
                                      alt="Mention"
                                      className="w-10 h-10 rounded-md object-cover border border-gray-200"
                                    />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`text-xs text-center py-4 ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                        No mentions found at this location
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

