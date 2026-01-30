'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import type { Account } from '@/features/auth';

function getTimeAgo(isoDate: string): string {
  const diffSeconds = Math.max(0, (Date.now() - new Date(isoDate).getTime()) / 1000);
  const days = Math.floor(diffSeconds / 86400);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/** Same structure as loaded card: three sections with 1:1 skeleton per element. ProfilePhoto sm = w-8 h-8. */
function PinCardSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-3 space-y-2 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2 min-w-0 flex-1">
          {/* Section 1: account image */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gray-200 animate-pulse" aria-hidden />
          {/* Section 2 + 3: username area, then content + lat/lng */}
          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Section 2: username · Pin line (text-xs) */}
            <div className="h-3.5 w-28 rounded bg-gray-200 animate-pulse" aria-hidden />
            {/* Section 3: content line (snippet) + mention_type + time ago */}
            <div className="h-3 w-full max-w-[160px] rounded bg-gray-100 animate-pulse" aria-hidden />
            <div className="h-2.5 w-20 rounded bg-gray-100 animate-pulse" aria-hidden />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 p-0 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
}

export interface LivePinData {
  id: string;
  map_id: string;
  lat: number;
  lng: number;
  description: string | null;
  caption: string | null;
  emoji: string | null;
  image_url: string | null;
  video_url?: string | null;
  account_id: string | null;
  created_at: string;
  account?: {
    id: string;
    username: string | null;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  } | null;
  mention_type?: {
    id: string;
    emoji: string | null;
    name: string;
  } | null;
}

interface LivePinCardProps {
  pinId: string;
  /** When provided (from MapPage initialPins or MapIDBox fetch), no API call — single source of truth. */
  pin?: LivePinData | null;
  onClose: () => void;
  /** Current viewer's account id (from auth). When equal to pin.account_id, the owner is viewing. */
  currentAccountId?: string | null;
}

export default function LivePinCard({ pinId, pin: pinProp, onClose, currentAccountId }: LivePinCardProps) {
  const pin = pinProp ?? null;
  const loading = Boolean(pinId && pin === null);
  const isViewerOwner =
    pin != null &&
    pin.account_id != null &&
    currentAccountId != null &&
    String(pin.account_id) === String(currentAccountId);

  if (loading) {
    return <PinCardSkeleton onClose={onClose} />;
  }

  if (!pin) {
    return (
      <div className="p-3 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">Pin not found</span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 p-0 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    );
  }

  const hasAccount = pin.account != null && (pin.account.username != null || pin.account.image_url != null);
  const snippet = pin.description ?? pin.caption ?? pin.emoji ?? null;
  const timeAgo = getTimeAgo(pin.created_at);
  const mentionTypeLabel = pin.mention_type?.name ?? null;
  const mentionTypeEmoji = pin.mention_type?.emoji ?? null;

  // Same structure as PinCardSkeleton: three sections (account image, username area, content + mention_type + time)
  return (
    <div
      className="p-3 space-y-2 border-b border-gray-100 last:border-0"
      data-viewer-owner={isViewerOwner ? 'true' : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2 min-w-0 flex-1">
          {/* Section 1: account image */}
          {hasAccount ? (
            <div className="flex-shrink-0">
              <ProfilePhoto account={pin.account as unknown as Account} size="sm" editable={false} />
            </div>
          ) : (
            <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gray-200 animate-pulse" aria-hidden />
          )}
          {/* Section 2: username area. Section 3: content + mention_type + time ago */}
          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Section 2: username · Pin */}
            {hasAccount ? (
              <p className="text-xs text-gray-900">
                {pin.account!.username ? (
                  <Link
                    href={`/${encodeURIComponent(pin.account!.username)}`}
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {pin.account!.username}
                  </Link>
                ) : (
                  <span className="font-medium text-gray-600">Pin</span>
                )}
              </p>
            ) : (
              <div className="h-3.5 w-28 rounded bg-gray-200 animate-pulse" aria-hidden />
            )}
            {/* Section 3: content (snippet) + media links + mention_type + time ago */}
            {snippet ? (
              <p className="text-xs text-gray-600 truncate">{snippet}</p>
            ) : (
              <div className="h-3 w-full max-w-[160px] rounded bg-gray-100 animate-pulse" aria-hidden />
            )}
            {(pin.image_url || pin.video_url) && (
              <p className="text-xs">
                {pin.image_url && (
                  <a
                    href={pin.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    +1 image
                  </a>
                )}
                {pin.image_url && pin.video_url && <span className="text-gray-400 mx-1">·</span>}
                {pin.video_url && (
                  <a
                    href={pin.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    + video
                  </a>
                )}
              </p>
            )}
            <p className="text-[10px] text-gray-500">
              {mentionTypeLabel != null && (
                <>
                  {mentionTypeEmoji && <span className="mr-0.5">{mentionTypeEmoji}</span>}
                  <span>{mentionTypeLabel}</span>
                  {' · '}
                </>
              )}
              {timeAgo}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 p-0 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
}
