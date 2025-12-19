'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  EllipsisHorizontalIcon,
  MapPinIcon,
  GlobeAltIcon,
  UserGroupIcon,
  LockClosedIcon,
  PlayIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import ProfilePhoto from '@/components/ProfilePhoto';
import { Account } from '@/features/auth';
import { formatProfileType } from '@/features/profiles/constants/profileTypes';
import Views from '@/components/ui/Views';
import { PostMapData } from './PostMapModal';
import { 
  filterValidMedia, 
  isVideo, 
  getPostUrl, 
  getProfileUrl
} from './utils/feedHelpers';
import PostMapRenderer from './PostMapRenderer';

// Simple video player
function VideoPlayer({ 
  src, 
  title, 
  alt,
  poster
}: { 
  src: string; 
  title?: string; 
  alt?: string;
  poster?: string;
}) {
  return (
    <video
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      className="w-full h-full object-cover"
      aria-label={title || alt}
    />
  );
}

export interface FeedPostData {
  id: string;
  account_id: string;
  title?: string | null;
  content: string;
  images?: Array<{ url: string; filename: string; type?: string; thumbnail_url?: string }> | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  full_address?: string | null;
  visibility?: 'public' | 'draft';
  type?: 'simple';
  view_count?: number;
  // Map fields from posts table
  map_type?: 'pin' | 'area' | 'both' | null;
  map_geometry?: unknown; // GeoJSON geometry
  map_center?: unknown; // PostGIS POINT
  map_bounds?: unknown; // PostGIS POLYGON
  map_hide_pin?: boolean;
  map_screenshot?: string | null;
  // Legacy map_data for backward compatibility
  map_data?: { 
    type: 'pin' | 'area' | 'both'; 
    geometry: GeoJSON.Point | GeoJSON.Polygon | GeoJSON.MultiPolygon;
    center?: [number, number];
    polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon; // For 'both' type
    screenshot?: string;
  } | null;
  created_at: string;
  updated_at: string;
  accounts?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
    username?: string | null;
    plan?: 'hobby' | 'pro';
  } | null;
}

interface FeedPostProps {
  post: FeedPostData;
  onUpdate?: () => void;
  disableNavigation?: boolean; // Disable click navigation (for individual post pages)
}

export default function FeedPost({ post, onUpdate, disableNavigation = false }: FeedPostProps) {
  const router = useRouter();

  // Memoize derived data for performance
  const account = useMemo(() => (post as { accounts?: { id: string; first_name: string | null; last_name: string | null; image_url: string | null; username: string | null; plan?: 'hobby' | 'pro' } | null }).accounts, [(post as { accounts?: { id: string; first_name: string | null; last_name: string | null; image_url: string | null; username: string | null; plan?: 'hobby' | 'pro' } | null }).accounts]);
  // Display name from account (first_name + last_name) or fallback to 'User'
  const displayName = useMemo(() => {
    if (account?.first_name || account?.last_name) {
      return `${account.first_name || ''} ${account.last_name || ''}`.trim();
    }
    return 'User';
  }, [account?.first_name, account?.last_name]);
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'recently';
    }
  }, [post.created_at]);
  
  const validMedia = useMemo(() => filterValidMedia(post.images), [post.images]);
  const hasMap = useMemo(() => !!(post.map_geometry || post.map_data || post.map_screenshot), [post.map_geometry, post.map_data, post.map_screenshot]);
  const showMediaLink = useMemo(() => validMedia.length > 0 && hasMap, [validMedia.length, hasMap]);
  const postUrl = useMemo(() => getPostUrl({ id: post.id, slug: undefined }), [post.id]);
  // Profile URL - profiles removed, use account settings instead
  const profileUrl = useMemo(() => {
    return '#';
  }, []);
  const locationText = useMemo(() => {
    // If hidePin is true, only show city
    if (post.map_hide_pin) {
      return post.city || '';
    }
    // Otherwise show city, county, state as normal
    const parts: string[] = [];
    if (post.city) parts.push(post.city);
    if (post.county) parts.push(post.county);
    if (post.state) parts.push(post.state);
    return parts.length > 0 ? parts.join(', ') : '';
  }, [post.city, post.county, post.state, post.map_hide_pin]);
  // Profile type label removed - using account data only

  const handlePostClick = useCallback(() => {
    if (!disableNavigation) {
      router.push(postUrl);
    }
  }, [disableNavigation, postUrl, router]);

  return (
    <article 
      className="bg-white border border-gray-200 rounded-md overflow-hidden transition-colors"
      aria-label={`Post by ${displayName}: ${post.title}`}
    >
      {/* Header */}
      <header 
        className={`p-[10px] ${!disableNavigation ? 'cursor-pointer' : ''}`} 
        onClick={!disableNavigation ? handlePostClick : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Profile Photo - Show account image */}
            <div className="flex-shrink-0">
              <ProfilePhoto
                account={account ? {
                  id: account.id,
                  user_id: null,
                  username: account.username,
                  first_name: account.first_name,
                  last_name: account.last_name,
                  email: null,
                  phone: null,
                  image_url: account.image_url,
                  cover_image_url: null,
                  bio: null,
                  city_id: null,
                  view_count: 0,
                  role: 'general',
                  traits: null,
                  stripe_customer_id: null,
                  plan: account.plan || 'hobby',
                  billing_mode: 'standard',
                  subscription_status: null,
                  stripe_subscription_id: null,
                  onboarded: false,
                  created_at: '',
                  updated_at: '',
                  last_visit: null,
                } as Account : null}
                size="sm"
              />
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <div className="block">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-medium text-gray-900 inline text-xs">
                      {displayName}
                    </h3>
                    {account?.plan === 'pro' && (
                      <span className="px-1.5 py-0.5 bg-[#D4AF37] text-white text-[10px] font-semibold rounded uppercase tracking-wide" title="Pro Member">
                        Pro
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-1.5 text-xs text-gray-600 flex-wrap mt-0.5">
                <time dateTime={post.created_at} className="text-xs">
                  {timeAgo}
                </time>
                {/* Visibility */}
                {post.visibility && (
                  <>
                    <span aria-hidden="true">·</span>
                    <div className="flex items-center gap-1" role="status" aria-label={`Visibility: ${post.visibility}`}>
                      {post.visibility === 'public' && (
                        <>
                          <GlobeAltIcon className="w-3 h-3" aria-hidden="true" />
                          <span className="text-gray-600 text-xs font-medium">Public</span>
                        </>
                      )}
                      {post.visibility === 'draft' && (
                        <>
                          <LockClosedIcon className="w-3 h-3" aria-hidden="true" />
                          <span className="text-gray-500 text-xs font-medium">Draft</span>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* Location Breadcrumb */}
                {locationText && (
                  <>
                    <span aria-hidden="true">·</span>
                    <div className="flex items-center gap-1 min-w-0 max-w-[200px]" aria-label="Location">
                      <MapPinIcon className="w-3 h-3 flex-shrink-0 text-gray-400" aria-hidden="true" />
                      <span className="text-xs text-gray-600 font-medium truncate">
                        {locationText}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          <Link
            href={postUrl}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Post options"
          >
            <EllipsisHorizontalIcon className="w-4 h-4 text-gray-500" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className={`px-[10px] pb-2 ${!disableNavigation ? 'cursor-pointer' : ''}`} onClick={!disableNavigation ? handlePostClick : undefined}>
        {post.title && (
          !disableNavigation ? (
            <Link 
              href={postUrl} 
              className="block"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-semibold text-sm text-gray-900 mb-1.5 hover:text-gray-700 hover:underline transition-colors">
                {post.title}
              </h2>
            </Link>
          ) : (
            <h2 className="font-semibold text-sm text-gray-900 mb-1.5">{post.title}</h2>
          )
        )}
        <div className="text-xs text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
          {post.content}
        </div>
        {/* Media Link - Show when media exists but map is displayed */}
        {showMediaLink && (
          <Link
            href={postUrl}
            onClick={(e) => {
              e.stopPropagation();
              if (!disableNavigation) {
                router.push(postUrl);
              }
            }}
            className="inline-block mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            See +{validMedia.length} {validMedia.length === 1 ? 'Media' : 'Media'}
          </Link>
        )}
      </div>

      {/* Media Gallery - Only show if no map */}
      {validMedia.length > 0 && !hasMap && (
        <div className="px-[10px] pb-2" role="group" aria-label="Post media">
          <div 
            className="grid gap-1.5" 
            style={{
              gridTemplateColumns: validMedia.length === 1 ? '1fr' : 'repeat(2, 1fr)'
            }}
          >
            {validMedia.slice(0, 4).map((media, idx) => {
              const mediaIsVideo = isVideo(media);
              
              return (
                <div
                  key={`${media.url}-${idx}`}
                  className="relative aspect-video bg-gray-100 rounded-md overflow-hidden"
                >
                  {mediaIsVideo ? (
                    <VideoPlayer
                      src={media.url}
                      title={post.title || `Post video ${idx + 1}`}
                      alt={`Video ${idx + 1} for ${post.title || 'post'}`}
                      poster={media.thumbnail_url}
                    />
                  ) : (
                    <Image
                      src={media.url}
                      alt={post.title ? `${post.title} - Image ${idx + 1}` : `Post image ${idx + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                      unoptimized={media.url.includes('supabase.co')}
                      priority={idx === 0} // Prioritize first image
                    />
                  )}
                </div>
              );
            })}
          </div>
          {validMedia.length > 4 && (
            <p className="text-xs text-gray-500 mt-1.5 text-center">
              +{validMedia.length - 4} more {validMedia.length - 4 === 1 ? 'item' : 'items'}
            </p>
          )}
        </div>
      )}

      {/* Map */}
      {(post.map_geometry || post.map_data || post.map_screenshot) && (
        <div className="px-[10px] pb-2">
          <PostMapRenderer 
            mapData={{
              type: (() => {
                // map_data is the source of truth - use its type directly
                const mapData = post.map_data as PostMapData | undefined;
                if (mapData && 'type' in mapData && mapData.type) {
                  return mapData.type;
                }
                // Fallback to explicit map_type from database columns
                if (post.map_type) {
                  return post.map_type;
                }
                // Infer from geometry if no type specified
                if (mapData && 'geometry' in mapData && mapData.geometry) {
                  const geometry = mapData.geometry;
                  if ('type' in geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
                    // If there's also a center, it's 'both', otherwise 'area'
                    return mapData.center ? 'both' : 'area';
                  }
                  if ('type' in geometry && geometry.type === 'Point') {
                    return 'pin';
                  }
                }
                // Check new format columns
                if (post.map_geometry && typeof post.map_geometry === 'object' && post.map_geometry !== null && 'type' in post.map_geometry) {
                  const geometry = post.map_geometry as { type: string };
                  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
                    return post.map_center ? 'both' : 'area';
                  }
                  if (geometry.type === 'Point') {
                    return 'pin';
                  }
                }
                // Default fallback
                return 'pin';
              })(),
              geometry: (post.map_geometry || (post.map_data as PostMapData | undefined)?.geometry || { type: 'Point', coordinates: [0, 0] }) as GeoJSON.Point | GeoJSON.Polygon | GeoJSON.MultiPolygon,
              center: (post.map_data as PostMapData | undefined)?.center || undefined,
              screenshot: post.map_screenshot || (post.map_data as PostMapData | undefined)?.screenshot,
              polygon: (post.map_data as PostMapData | undefined)?.polygon,
            }}
            height="300px"
            onClick={() => !disableNavigation && router.push(postUrl)}
          />
        </div>
      )}

      {/* Engagement Stats */}
      {typeof post.view_count === 'number' && post.view_count > 0 && (
        <footer className="px-[10px] py-1.5 border-t border-gray-200 bg-gray-50">
          <Views count={post.view_count} className="text-gray-600 text-xs" />
        </footer>
      )}
    </article>
  );
}



