'use client';

import Image from 'next/image';
import Link from 'next/link';
import { formatPinDate } from '@/types/profile';
import type { ProfilePin } from '@/types/profile';
import { EyeIcon, HeartIcon, MapPinIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { getMapUrlWithPin } from '@/lib/maps/urls';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

interface ProfileMentionsListProps {
  pins: ProfilePin[];
  isOwnProfile?: boolean;
  onViewMap?: () => void;
}

function PinSkeleton({ onClick, isLast, hasImage }: { onClick?: () => void; isLast?: boolean; hasImage?: boolean }) {
  return (
    <div 
      className="relative flex gap-3 pb-4 last:pb-0 cursor-pointer hover:bg-gray-50 transition-colors rounded-md p-2 -m-2"
      onClick={onClick}
    >
      {/* Timeline Circle and Line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0 mt-1.5 animate-pulse" />
        {!isLast && (
          <div className="w-px h-full bg-gray-200 flex-1 min-h-[60px] mt-1" />
        )}
      </div>

      {/* Content Skeleton */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Description skeleton */}
        <div className="space-y-1.5">
          <div className="h-3 w-full max-w-md bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-3/4 max-w-sm bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Image skeleton - only show if pin has an image */}
        {hasImage && (
          <div className="w-full max-w-xs h-48 bg-gray-200 rounded-md animate-pulse" />
        )}

        {/* Metadata skeleton */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Timestamp skeleton */}
        <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />

        {/* Sign in prompt */}
        <div className="pt-2">
          <button className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
            Sign in to view details
          </button>
        </div>
      </div>
    </div>
  );
}

function getViewOnMapHref(pin: ProfilePin): string {
  const isLive = pin.map?.slug === 'live';
  if (isLive) return `/live?pin=${encodeURIComponent(pin.id)}`;
  if (pin.map && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
    return getMapUrlWithPin({ id: pin.map.id, slug: pin.map.slug ?? null }, pin.lat, pin.lng);
  }
  return `/live?pin=${encodeURIComponent(pin.id)}`;
}

export default function ProfileMentionsList({ pins, isOwnProfile = false, onViewMap }: ProfileMentionsListProps) {
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const isAuthenticated = Boolean(account);
  
  // Only show pins the profile account has posted: owner sees all, visitor sees only public
  const filteredPins = pins.filter(pin => isOwnProfile || pin.visibility === 'public');
  
  // For non-authenticated visitors, show skeletons that prompt signup
  if (!isAuthenticated && !isOwnProfile) {
    if (filteredPins.length === 0) {
      return (
        <div className="p-6">
          <p className="text-sm text-gray-500 text-center py-8">No mentions found</p>
        </div>
      );
    }
    return (
      <div>
        <div className="p-6">
          <div className="relative">
            {filteredPins.map((pin, index) => (
              <PinSkeleton 
                key={pin.id} 
                onClick={openWelcome} 
                isLast={index === filteredPins.length - 1}
                hasImage={Boolean(pin.image_url || pin.video_url)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (filteredPins.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500 text-center py-8">No mentions found</p>
      </div>
    );
  }

  return (
    <div>
      {/* List Content */}
      <div className="p-6">
      <div className="relative">
        {/* Vertical Timeline */}
        {filteredPins.map((pin, index) => (
          <div key={pin.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Timeline Circle and Line */}
            <div className="flex flex-col items-center flex-shrink-0">
              {/* Circle */}
              <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0 mt-1.5" />
              {/* Vertical Line - only show if not last item */}
              {index < filteredPins.length - 1 && (
                <div className="w-px h-full bg-gray-200 flex-1 min-h-[60px] mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Description */}
              {pin.description && (
                <p className="text-xs text-gray-900 leading-relaxed">
                  {pin.description}
                </p>
              )}

              {/* Media */}
              {pin.image_url && (
                <div className="relative w-full max-w-xs rounded-md overflow-hidden border border-gray-200">
                  <Image
                    src={pin.image_url}
                    alt={pin.description || 'Mention image'}
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover"
                    unoptimized={pin.image_url.startsWith('data:') || pin.image_url.includes('supabase.co')}
                  />
                </div>
              )}
              {pin.video_url && (
                <div className="relative w-full max-w-xs rounded-md overflow-hidden border border-gray-200">
                  <video
                    src={pin.video_url}
                    controls
                    className="w-full h-auto"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* Metadata Row - Mention Type, Collection, Views, Likes */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mention Type */}
                {pin.mention_type && (
                  <span className="text-[10px] text-gray-600">
                    {pin.mention_type.emoji} {pin.mention_type.name}
                  </span>
                )}
                
                {/* Collection Badge */}
                {pin.collection && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                    <span>{pin.collection.emoji}</span>
                    <span>{pin.collection.title}</span>
                  </span>
                )}
                
                {/* View Count */}
                {(pin.view_count !== undefined && pin.view_count > 0) && (
                  <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
                    <EyeIcon className="w-3 h-3" />
                    <span>{pin.view_count}</span>
                  </div>
                )}
                
                {/* Like Count */}
                {(pin.likes_count !== undefined && pin.likes_count > 0) && (
                  <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
                    <HeartIcon className="w-3 h-3" />
                    <span>{pin.likes_count}</span>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <p className="text-[10px] text-gray-500">
                {formatPinDate(pin.created_at)}
              </p>

              {/* View on Map + See post - public profile only */}
              {!isOwnProfile && (
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={getViewOnMapHref(pin)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:underline"
                  >
                    <MapPinIcon className="w-3.5 h-3.5" />
                    View on Map
                  </Link>
                  <Link
                    href={`/mention/${pin.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:underline"
                  >
                    <DocumentTextIcon className="w-3.5 h-3.5" />
                    See post
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
