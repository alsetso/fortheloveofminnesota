'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserIcon, MapPinIcon, EyeIcon } from '@heroicons/react/24/outline';
import { getMapUrl, getMapUrlWithPin } from '@/lib/maps/urls';
import type { FeedMap, FeedPinActivity } from '@/app/api/feed/pin-activity/route';
import { useAuthStateSafe } from '@/features/auth';
import MentionTypeCards from './MentionTypeCards';

function getRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 604800)}w ago`;
  if (diffSeconds < 31536000) return `${Math.floor(diffSeconds / 2592000)}mo ago`;
  return `${Math.floor(diffSeconds / 31536000)}y ago`;
}

interface PinActivityFeedProps {
  maps: FeedMap[];
  activity: FeedPinActivity[];
  loading?: boolean;
}

export default function PinActivityFeed({ maps, activity, loading }: PinActivityFeedProps) {
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-md p-[10px] h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Feed from: maps as list cards */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Feed from</p>
        {maps.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-500">No maps yet. Join or create a map to see pin activity.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {maps.map((map) => (
              <Link
                key={map.id}
                href={getMapUrl({ id: map.id, slug: map.slug ?? undefined })}
                className="block bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-gray-900">{map.name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* What you can post - mention type cards */}
      <MentionTypeCards isAdmin={isAdmin} />

      {/* Map pins list */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Map pins</p>
        {activity.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-500">No pin activity yet on your maps.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((item) => (
              <PinActivityItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const isLiveMap = (map: FeedPinActivity['map']) =>
  map?.slug === 'live';

function PinActivityItem({ item }: { item: FeedPinActivity }) {
  const router = useRouter();
  const mapHref = item.map
    ? isLiveMap(item.map)
      ? '/live'
      : getMapUrl({ id: item.map.id, slug: item.map.slug ?? undefined })
    : '#';
  const hasLatLng =
    item.lat != null &&
    item.lng != null &&
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lng);
  const cardHref =
    item.map && (hasLatLng || item.id)
      ? isLiveMap(item.map)
        ? `/live?pin=${encodeURIComponent(item.id)}`
        : hasLatLng
          ? getMapUrlWithPin(
              { id: item.map.id, slug: item.map.slug ?? undefined },
              item.lat!,
              item.lng!
            )
          : mapHref
      : mapHref;
  const displayName = item.account?.username ?? 'Someone';
  const relativeTime = getRelativeTime(item.created_at);
  const snippet = item.description ?? item.caption ?? item.emoji ?? null;
  const hasVideo = !!(item.video_url || item.media_type === 'video');

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) return;
    router.push(`/mention/${item.id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!(e.target as HTMLElement).closest('a') && !(e.target as HTMLElement).closest('button')) {
            router.push(`/mention/${item.id}`);
          }
        }
      }}
      className="block bg-white border border-gray-200 rounded-md p-3 hover:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex gap-1.5">
        <div className="flex-shrink-0">
          {item.account?.image_url ? (
            <img
              src={item.account.image_url}
              alt=""
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
              <UserIcon className="w-3 h-3 text-gray-500" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 min-h-0 self-start">
          <p className="text-xs text-gray-900 leading-tight">
            {item.account?.username ? (
              <Link
                href={`/${encodeURIComponent(item.account.username)}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {displayName}
              </Link>
            ) : (
              <span className="font-medium">{displayName}</span>
            )}
            {' added a pin to '}
            {item.map ? (
              <Link
                href={mapHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {item.map.name}
              </Link>
            ) : (
              'a map'
            )}
            {' · '}
            <span className="text-gray-500">{relativeTime}</span>
          </p>
          {snippet && (
            <p className="text-xs text-gray-600 truncate mt-0.5 leading-tight">{snippet}</p>
          )}
          {/* Row: mention type · video · View (no wrap) - below description */}
          <div className="flex flex-nowrap items-baseline gap-x-1.5 mt-0.5 leading-none text-[10px] min-w-0">
            {item.mention_type && (
              <span className="text-gray-600 shrink-0">
                <span>{item.mention_type.emoji}</span>
                <span className="ml-0.5">{item.mention_type.name}</span>
              </span>
            )}
            {item.mention_type && hasVideo && (
              <span className="text-gray-300 shrink-0">·</span>
            )}
            {hasVideo && (
              <span className="text-gray-600 shrink-0 whitespace-nowrap">+ video</span>
            )}
            {(item.mention_type || hasVideo) && (
              <span className="text-gray-300 shrink-0">·</span>
            )}
            <Link
              href={item.map && isLiveMap(item.map) ? `/live?pin=${encodeURIComponent(item.id)}` : cardHref}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 font-medium inline-flex items-center gap-0.5 whitespace-nowrap text-gray-600 hover:text-gray-900 transition-colors leading-none py-0"
            >
              <EyeIcon className="w-2.5 h-2.5" />
              View on Map
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
