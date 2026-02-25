'use client';

import { PencilIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import type { Account } from '@/features/auth';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

function getTimeAgo(isoDate: string): string {
  const diffSeconds = Math.max(0, (Date.now() - new Date(isoDate).getTime()) / 1000);
  const days = Math.floor(diffSeconds / 86400);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/** Same structure as loaded card: three sections with 1:1 skeleton per element. ProfilePhoto sm = w-8 h-8. */
function PinCardSkeleton() {
  return (
    <div className="border-b border-border-muted last:border-0">
      <div className="p-[10px] space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-2 min-w-0 flex-1">
            {/* Section 1: account image */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-surface-accent animate-pulse" aria-hidden />
            {/* Section 2 + 3: username area, then content + lat/lng */}
            <div className="min-w-0 flex-1 space-y-0.5">
              {/* Section 2: username · Pin line (text-xs) */}
              <div className="h-3.5 w-28 rounded bg-surface-accent animate-pulse" aria-hidden />
              {/* Section 3: content line (snippet) + mention_type + time ago */}
              <div className="h-3 w-full max-w-[160px] rounded bg-surface-accent animate-pulse" aria-hidden />
              <div className="h-2.5 w-20 rounded bg-surface-accent animate-pulse" aria-hidden />
            </div>
          </div>
        </div>
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
  /** Resolved tagged users (from tagged_account_ids); only present when pin has tagged users */
  tagged_accounts?: { id: string; username: string | null }[] | null;
}

interface LivePinCardProps {
  pinId: string;
  /** When provided (from MapPage initialPins or MapIDBox fetch), no API call — single source of truth. */
  pin?: LivePinData | null;
  /** Current viewer's account id (from auth). When equal to pin.account_id, the owner is viewing. */
  currentAccountId?: string | null;
  /** Optional close callback (e.g. for overlay card). */
  onClose?: () => void;
}

export default function LivePinCard({ pinId, pin: pinProp, currentAccountId, onClose }: LivePinCardProps) {
  const { account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const isAuthenticated = Boolean(account || activeAccountId);
  const pin = pinProp ?? null;
  const loading = Boolean(pinId && pin === null);
  const isViewerOwner =
    pin != null &&
    pin.account_id != null &&
    currentAccountId != null &&
    String(pin.account_id) === String(currentAccountId);

  const hasContent = pin && (pin.description || pin.caption || pin.emoji || pin.image_url || pin.video_url);

  // If loading, show skeleton
  if (loading) {
    return <PinCardSkeleton />;
  }

  if (!pin) {
    return (
      <div className="border-b border-border-muted last:border-0">
        <div className="p-[10px] flex items-center justify-between gap-2">
          <span className="text-xs text-foreground-muted">Pin not found</span>
        </div>
      </div>
    );
  }

  const hasAccount = pin.account != null && (pin.account.username != null || pin.account.image_url != null);
  const snippet = pin.description ?? pin.caption ?? pin.emoji ?? null;
  const timeAgo = getTimeAgo(pin.created_at);
  const mentionTypeLabel = pin.mention_type?.name ?? null;
  const mentionTypeEmoji = pin.mention_type?.emoji ?? null;

  // Same structure as PinCardSkeleton: three sections (account image, username area, content + mention_type + time)
  // Media (images/videos) shown edge-to-edge, other content wrapped in padding
  return (
    <div
      className="border-b border-border-muted last:border-0"
      data-viewer-owner={isViewerOwner ? 'true' : undefined}
    >
      {/* Media section - edge-to-edge, no padding */}
      {(pin.image_url || pin.video_url) && (
        <div className="w-full">
          {pin.image_url && (
            <Link
              href={`/mention/${pin.id}`}
              className="block w-full focus:outline-none focus:ring-2 focus:ring-foreground-subtle focus:ring-offset-1"
            >
              <img
                src={pin.image_url}
                alt=""
                className="w-full max-h-[200px] object-cover"
              />
            </Link>
          )}
          {pin.video_url && (
            <Link
              href={`/mention/${pin.id}`}
              className="block w-full focus:outline-none focus:ring-2 focus:ring-foreground-subtle focus:ring-offset-1"
            >
              <video
                src={pin.video_url}
                preload="metadata"
                muted
                playsInline
                className="w-full max-h-[200px] object-cover pointer-events-none"
                aria-label="Video thumbnail"
              />
            </Link>
          )}
        </div>
      )}
      
      {/* Content section - wrapped in padding */}
      <div className="p-[10px] space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-2 min-w-0 flex-1">
            {/* Section 1: account image */}
            {hasAccount ? (
              <div className="flex-shrink-0">
                <ProfilePhoto account={pin.account as unknown as Account} size="sm" editable={false} />
              </div>
            ) : (
              <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-surface-accent animate-pulse" aria-hidden />
            )}
            {/* Section 2: username area. Section 3: content + mention_type + time ago */}
            <div className="min-w-0 flex-1 space-y-0.5">
              {/* Section 2: username · Pin */}
              {hasAccount ? (
                <p className="text-xs text-foreground">
                  {pin.account!.username ? (
                    <Link
                      href={`/${encodeURIComponent(pin.account!.username)}`}
                      className="font-medium text-accent hover:text-accent-hover hover:underline"
                    >
                      {pin.account!.username}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground-muted">Pin</span>
                  )}
                </p>
              ) : (
                <div className="h-3.5 w-28 rounded bg-surface-accent animate-pulse" aria-hidden />
              )}
              {/* Section 3: content (snippet) + mention_type + time ago */}
              {snippet ? (
                <p className="text-xs text-foreground-muted truncate">{snippet}</p>
              ) : hasContent ? (
                <div className="h-3 w-full max-w-[160px] rounded bg-surface-accent animate-pulse" aria-hidden />
              ) : isViewerOwner ? (
                <Link
                  href={`/mention/${pin.id}/edit`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover hover:underline"
                >
                  <PencilIcon className="w-3 h-3" />
                  <span>Add photo or caption</span>
                </Link>
              ) : (
                <p className="text-xs text-foreground-muted italic">No description</p>
              )}
              {pin.tagged_accounts && pin.tagged_accounts.length > 0 && (
                <p className="mt-2 text-[10px] text-foreground-muted">
                  Tagged{' '}
                  {pin.tagged_accounts.map((acc, i) => (
                    <span key={acc.id}>
                      {i > 0 && ', '}
                      {acc.username ? (
                        <Link
                          href={`/${encodeURIComponent(acc.username)}`}
                          className="text-accent hover:text-accent-hover hover:underline"
                        >
                          @{acc.username}
                        </Link>
                      ) : (
                        <span className="text-foreground-muted">@{acc.id.slice(0, 8)}…</span>
                      )}
                    </span>
                  ))}
                </p>
              )}
              <p className="text-[10px] text-foreground-muted">
                {mentionTypeLabel != null && (
                  <>
                    {mentionTypeEmoji && <span className="mr-0.5">{mentionTypeEmoji}</span>}
                    <span>{mentionTypeLabel}</span>
                    {' · '}
                  </>
                )}
                {timeAgo}
              </p>
              <Link
                href={`/mention/${pin.id}`}
                className="inline-block text-xs font-medium text-accent hover:text-accent-hover hover:underline mt-1"
              >
                View More
              </Link>
            </div>
          </div>
        </div>
        {!isAuthenticated && (
          <div className="mt-2 pt-2 border-t border-border-muted">
            <p className="text-[10px] text-foreground-muted mb-1">
              Sign in to like, comment, or view full profile
            </p>
            <button
              type="button"
              onClick={openWelcome}
              className="text-xs font-medium text-accent hover:text-accent-hover hover:underline"
            >
              Sign in →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
