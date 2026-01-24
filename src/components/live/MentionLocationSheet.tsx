'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon, MapPinIcon, CheckIcon, EllipsisVerticalIcon, EyeIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Mention } from '@/types/mention';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { Account, useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { findYouTubeUrls } from '@/features/mentions/utils/youtubeHelpers';
import YouTubePreview from '@/features/mentions/components/YouTubePreview';
import LikeButton from '@/components/mentions/LikeButton';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';

interface MentionLocationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The selected/clicked mention to show in detail - can be partial Mention or full Mention */
  selectedMention?: Mention | {
    id: string;
    lat: number;
    lng: number;
    description?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    media_type?: 'image' | 'video' | 'none' | null;
    account_id?: string | null;
    account?: {
      username?: string | null;
      first_name?: string | null;
      image_url?: string | null;
      plan?: string | null;
    } | null;
    mention_type?: {
      id: string;
      emoji: string;
      name: string;
    } | null;
    created_at?: string;
    view_count?: number | null;
    likes_count?: number;
    is_liked?: boolean;
    map_meta?: Record<string, any> | null;
  } | null;
  /** Location data for location clicks (when type is 'location') */
  locationData?: {
    place_name?: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  } | null;
  /** Type of entity: 'mention' or 'location' */
  type?: 'mention' | 'location';
  /** Radius in kilometers for fetching nearby mentions */
  radius?: number;
  /** Callback when a nearby mention is clicked - updates URL and parent state */
  onMentionSelect?: (mentionId: string, lat: number, lng: number) => void;
}

/**
 * Unified iOS-style sheet that combines:
 * - Detailed view of selected mention (like MapEntityPopup)
 * - Location details for location clicks
 * - List of other nearby mentions (like LocationMentionsSheet)
 * 
 * Used when:
 * - User clicks a mention on the map
 * - User navigates from feed with mentionId in URL
 * - User clicks a location on the map (type === 'location')
 */
export default function MentionLocationSheet({
  isOpen,
  onClose,
  selectedMention,
  locationData,
  type = 'mention',
  radius = 0.5, // 500 meters default radius
  onMentionSelect,
}: MentionLocationSheetProps) {
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectedMentionRef = useRef<HTMLDivElement>(null);
  const [nearbyMentions, setNearbyMentions] = useState<Mention[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMapMetaInfo, setShowMapMetaInfo] = useState(false);
  const [likesCount, setLikesCount] = useState(selectedMention?.likes_count || 0);
  const [isLiked, setIsLiked] = useState(selectedMention?.is_liked || false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mapMetaInfoRef = useRef<HTMLDivElement>(null);
  const { user, account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();

  // Memoize center coordinates to avoid recalculating on every render
  const centerLat = useMemo(() => {
    if (type === 'location' && locationData?.coordinates) {
      return locationData.coordinates.lat;
    }
    if (selectedMention && typeof selectedMention.lat === 'number') {
      return selectedMention.lat;
    }
    return null;
  }, [type, locationData?.coordinates?.lat, locationData?.coordinates?.lng, selectedMention?.lat]);
  
  const centerLng = useMemo(() => {
    if (type === 'location' && locationData?.coordinates) {
      return locationData.coordinates.lng;
    }
    if (selectedMention && typeof selectedMention.lng === 'number') {
      return selectedMention.lng;
    }
    return null;
  }, [type, locationData?.coordinates?.lat, locationData?.coordinates?.lng, selectedMention?.lng]);

  // Fetch nearby mentions when sheet opens
  useEffect(() => {
    if (!isOpen || !centerLat || !centerLng) {
      setNearbyMentions([]);
      return;
    }

    const fetchNearbyMentions = async () => {
      setIsLoadingNearby(true);

      try {
        // Calculate bounding box from center point and radius
        const latDelta = radius / 111;
        const lngDelta = radius / 78; // Approximate for Minnesota latitude

        const bbox = {
          minLat: centerLat - latDelta,
          maxLat: centerLat + latDelta,
          minLng: centerLng - lngDelta,
          maxLng: centerLng + lngDelta,
        };

        // Use new nearby mentions API endpoint
        const response = await fetch(
          `/api/mentions/nearby?lat=${centerLat}&lng=${centerLng}&radius=${radius}${type === 'mention' && selectedMention ? `&include=${selectedMention.id}` : ''}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch nearby mentions');
        }
        
        const data = await response.json();
        const fetchedMentions = data.mentions || [];
        
        // Filter out the selected mention (only for mention type) - API already sorts by distance
        const filteredMentions = type === 'mention' && selectedMention
          ? fetchedMentions.filter((m: Mention) => m.id !== selectedMention.id)
          : fetchedMentions;

        setNearbyMentions(filteredMentions);
      } catch (err) {
        console.error('Error fetching nearby mentions:', err);
        setNearbyMentions([]);
      } finally {
        setIsLoadingNearby(false);
      }
    };

    // Small delay to ensure map has zoomed before fetching
    const timeoutId = setTimeout(() => {
      fetchNearbyMentions();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [isOpen, centerLat, centerLng, radius, type, selectedMention?.id]);

  // iOS-style slide-up animation
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      requestAnimationFrame(() => {
        if (popupRef.current) {
          popupRef.current.style.transform = 'translate(-50%, 0)';
        }
      });
    } else {
      document.body.style.overflow = '';
      if (popupRef.current) {
        popupRef.current.style.transform = 'translate(-50%, 100%)';
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Update likes state when selected mention changes
  useEffect(() => {
    if (selectedMention) {
      setLikesCount(selectedMention.likes_count || 0);
      setIsLiked(selectedMention.is_liked || false);
    }
  }, [selectedMention]);

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

  // Close map meta info when clicking outside
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

  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.style.transform = 'translate(-50%, 100%)';
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

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
      
      if (diffSeconds < 60) return 'just now';
      if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
      if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      
      const remainingHours = diffHours % 24;
      if (diffDays === 1) {
        if (remainingHours === 0) return '1 day ago';
        return `1 day and ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'} ago`;
      }
      
      if (diffDays < 7) {
        if (remainingHours === 0) return `${diffDays} days ago`;
        return `${diffDays} days and ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'} ago`;
      }
      
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;
  
  // For location type, we need locationData; for mention type, we need selectedMention
  if (type === 'location' && !locationData) return null;
  if (type === 'mention' && !selectedMention) return null;

  // Type guard to check if selectedMention is a full Mention
  const isFullMention = (m: typeof selectedMention): m is Mention => {
    return m !== null && m !== undefined && 'id' in m && typeof (m as any).lat === 'number' && typeof (m as any).lng === 'number';
  };
  
  const fullMention = selectedMention && isFullMention(selectedMention) ? selectedMention : null;
  const isOwner = user && account && fullMention && fullMention.account_id === account.id;
  const videoUrl = fullMention?.video_url || (selectedMention as any)?.video_url;
  const youtubeUrls = videoUrl ? findYouTubeUrls(videoUrl) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Slide-up Panel */}
      <div
        ref={popupRef}
        className="fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          bottom-0 left-1/2 -translate-x-1/2 bg-white"
        style={{
          transform: 'translate(-50%, 100%)',
          maxWidth: '750px',
          width: 'calc(100% - 2rem)',
          minHeight: '40vh',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
        }}
      >
        {/* Header - Compact */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 flex-shrink-0">
          {fullMention?.account || (selectedMention as any)?.account ? (
            <>
              {(() => {
                const account = fullMention?.account || (selectedMention as any)?.account;
                if (!account) return null;
                
                if (user && account.username) {
                  return (
                    <Link
                      href={`/profile/${encodeURIComponent(account.username)}`}
                      onClick={handleClose}
                      className="flex items-center gap-1.5"
                    >
                      <ProfilePhoto 
                        account={account as unknown as Account} 
                        size="xs" 
                        editable={false} 
                      />
                      <span className="text-xs font-medium text-gray-900 truncate">
                        {account.username}
                      </span>
                    </Link>
                  );
                } else if (user) {
                  return (
                    <div className="flex items-center gap-1.5">
                      <ProfilePhoto 
                        account={account as unknown as Account} 
                        size="xs" 
                        editable={false} 
                      />
                      <span className="text-xs font-medium text-gray-900">
                        {account.first_name || 'User'}
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <button
                      onClick={openWelcome}
                      className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-medium text-gray-500">?</span>
                      </div>
                      <span className="text-xs font-medium">Sign in</span>
                    </button>
                  );
                }
              })()}
            </>
          ) : type === 'location' ? (
            <div className="flex items-center gap-1.5">
              <MapPinIcon className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs font-medium text-gray-900">Location</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <MapPinIcon className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs font-medium text-gray-900">Mention</span>
            </div>
          )}
          
          <div className="flex items-center gap-0.5">
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-0.5 text-gray-500 hover:text-gray-900 transition-colors"
                aria-label="More options"
              >
                <EllipsisVerticalIcon className="w-3.5 h-3.5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 rounded-md shadow-lg z-10 min-w-[140px] bg-white border border-gray-200">
                  {(fullMention?.id || (selectedMention as any)?.id) && (
                    <Link
                      href={`/mention/${fullMention?.id || (selectedMention as any)?.id}`}
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <EyeIcon className="w-3.5 h-3.5" />
                      <span>More</span>
                    </Link>
                  )}
                  {((fullMention?.account || (selectedMention as any)?.account)?.username) && (
                    <Link
                      href={`/profile/${encodeURIComponent((fullMention?.account || (selectedMention as any)?.account)!.username!)}`}
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span>View Profile</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-0.5 text-gray-500 hover:text-gray-900 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* Selected Mention - Detailed View (only for mention type) */}
            {type === 'mention' && selectedMention && (
            <div ref={selectedMentionRef} className="space-y-2">
              {/* Map Metadata */}
              {(fullMention?.map_meta?.feature || selectedMention.map_meta?.feature) && (() => {
                const mapMeta = fullMention?.map_meta || selectedMention.map_meta;
                const feature = mapMeta?.feature;
                const props = feature.properties || {};
                let displayName = feature.name || 'Map Feature';
                if (!feature.name) {
                  if (props.type) displayName = String(props.type);
                  else if (props.class) displayName = String(props.class).replace(/_/g, ' ');
                  else if (feature.layerId) {
                    const layerId = feature.layerId.toLowerCase();
                    if (layerId.includes('poi')) displayName = 'Point of Interest';
                    else if (layerId.includes('building')) displayName = 'Building';
                    else if (layerId.includes('road') || layerId.includes('highway')) displayName = 'Road';
                    else if (layerId.includes('water')) displayName = 'Water';
                    else displayName = feature.layerId.replace(/-/g, ' ').replace(/_/g, ' ');
                  }
                }
                
                return (
                  <div className="relative">
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-50 border-gray-200">
                      {feature.icon && feature.icon !== '📍' && (
                        <span className="text-xs flex-shrink-0">{feature.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate text-gray-900">
                          {displayName}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMapMetaInfo(!showMapMetaInfo);
                        }}
                        className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Map metadata information"
                      >
                        <InformationCircleIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    {showMapMetaInfo && (
                      <div
                        ref={mapMetaInfoRef}
                        className="absolute top-full left-0 right-0 mt-1 z-50 border rounded-md shadow-lg p-2 bg-white border-gray-200"
                      >
                        <p className="text-xs text-gray-600">
                          This is map data from where this mention was created. It helps provide context about the location.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Mention Type */}
              {(fullMention?.mention_type || selectedMention.mention_type) && (() => {
                const mentionType = fullMention?.mention_type || selectedMention.mention_type;
                if (!mentionType) return null;
                
                return (
                  <button
                    onClick={() => {
                      handleClose();
                      const typeSlug = mentionTypeNameToSlug(mentionType.name);
                      router.push(`/live?type=${typeSlug}`);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm">{mentionType.emoji}</span>
                    <span className="text-xs font-medium text-gray-900">
                      {mentionType.name}
                    </span>
                  </button>
                );
              })()}

              {/* Description */}
              {(fullMention?.description || selectedMention.description) && (
                <p className="text-xs text-gray-900 leading-relaxed">
                  {fullMention?.description || selectedMention.description}
                </p>
              )}

              {/* Image */}
              {(fullMention?.image_url || selectedMention.image_url) && 
               (fullMention?.media_type || selectedMention.media_type) === 'image' && (
                <div className="relative w-full rounded-md overflow-hidden border border-gray-200">
                  <Image
                    src={(fullMention?.image_url || selectedMention.image_url)!}
                    alt="Mention"
                    width={600}
                    height={400}
                    className="w-full h-auto object-cover"
                    unoptimized
                  />
                </div>
              )}

              {/* Video/YouTube */}
              {(fullMention?.video_url || selectedMention.video_url) && 
               (fullMention?.media_type || selectedMention.media_type) === 'video' && (() => {
                const videoUrl = fullMention?.video_url || selectedMention.video_url;
                if (!videoUrl) return null;
                const videoYoutubeUrls = findYouTubeUrls(videoUrl);
                
                return (
                  <div className="w-full">
                    {videoYoutubeUrls.length > 0 ? (
                      <YouTubePreview url={videoUrl} />
                    ) : (
                      <video
                        src={videoUrl}
                        controls
                        className="w-full rounded-md"
                      />
                    )}
                  </div>
                );
              })()}

              {/* Actions Row */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  {fullMention?.id && (
                    <LikeButton
                      mentionId={fullMention.id}
                      initialLikesCount={likesCount}
                      initialIsLiked={isLiked}
                      onLikeChange={(count, liked) => {
                        setLikesCount(count);
                        setIsLiked(liked);
                      }}
                      size="sm"
                    />
                  )}
                  {(fullMention?.view_count !== null && fullMention?.view_count !== undefined) && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <EyeIcon className="w-3.5 h-3.5" />
                      <span>{fullMention.view_count}</span>
                    </div>
                  )}
                </div>
                {(fullMention?.created_at || selectedMention.created_at) && (
                  <span className="text-[10px] text-gray-500">
                    {formatTimeAgo(fullMention?.created_at || selectedMention.created_at)}
                  </span>
                )}
              </div>
            </div>
            )}

            {/* Location Content - Only for location type */}
            {type === 'location' && locationData && (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <MapPinIcon className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    {locationData.place_name && (
                      <div className="text-xs font-medium text-gray-900">
                        {locationData.place_name}
                      </div>
                    )}
                    {locationData.address && (
                      <div className="text-xs mt-0.5 text-gray-500">
                        {locationData.address}
                      </div>
                    )}
                    {locationData.coordinates && (
                      <div className="text-xs mt-1 text-gray-400">
                        {locationData.coordinates.lat.toFixed(6)}, {locationData.coordinates.lng.toFixed(6)}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Add Mention Button */}
                {locationData.coordinates && (
                  <>
                    {MinnesotaBoundsService.isWithinMinnesota(locationData.coordinates) ? (
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('show-location-for-mention', {
                            detail: { 
                              lat: locationData.coordinates!.lat, 
                              lng: locationData.coordinates!.lng 
                            }
                          }));
                          handleClose();
                        }}
                        className="w-full px-3 py-1.5 text-xs font-medium rounded-md transition-colors text-gray-900 bg-white border border-gray-200 hover:bg-gray-50"
                      >
                        Add Mention
                      </button>
                    ) : (
                      <div className="w-full px-4 py-2.5 text-xs rounded-md text-center text-gray-600 bg-gray-100">
                        Location outside Minnesota
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Divider */}
            {nearbyMentions.length > 0 && (
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPinIcon className="w-3.5 h-3.5 text-gray-600" />
                  <h3 className="text-xs font-medium text-gray-900">
                    Nearby Mentions
                  </h3>
                  <span className="text-[10px] text-gray-500">
                    ({nearbyMentions.length})
                  </span>
                </div>

                {/* Nearby Mentions List - Feed-style design */}
                {isLoadingNearby ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  </div>
                ) : (
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
                            } else {
                              // Fallback: update URL directly
                              router.push(`/live?lat=${mention.lat}&lng=${mention.lng}&mentionId=${mention.id}`);
                            }
                          }}
                          className="w-full text-left block bg-gray-50 border border-gray-200 rounded-md p-[10px] hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            {/* Mention Type Emoji */}
                            {mention.mention_type && (
                              <div className="flex-shrink-0 text-sm text-gray-600 leading-none mt-0.5">
                                {mention.mention_type.emoji}
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {mention.mention_type && (
                                <div className="text-xs font-medium text-gray-600 mb-0.5">
                                  {mention.mention_type.name}
                                </div>
                              )}
                              <p className="text-xs text-gray-900 line-clamp-2">
                                {truncatedDescription}
                              </p>
                            </div>

                            {/* Image Thumbnail (if available) */}
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
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
