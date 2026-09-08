'use client';

import { useCallback, useState, type KeyboardEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import {
  formatCompactTime,
  pinAuthorLabel,
  togglePinPostLike,
  type PinPostMedia,
} from '@/features/community/pinPostApi';
import { feedAuthorProfilePath } from '@/features/community/profileApi';
import { PinMediaLightbox } from '@/features/community/PinMediaLightbox';
import { PostLightboxActions } from '@/features/community/PostLightboxActions';
import { PostOverflowMenu } from '@/features/community/PostOverflowMenu';
import { PostPlaceLine } from '@/features/feed/PostPlaceLine';
import { PostSeeOnMapPopover } from '@/features/feed/PostSeeOnMapPopover';
import { useFeedPostImpression } from '@/features/feed/useFeedVisibility';
import { IconChat, IconHeart } from '@/features/map/dockCore/core/icons';
import { postPath } from '@/lib/routes/routePolicy';
import type { FeedItem } from '@/features/feed/feedApi';

function authorInitials(item: FeedItem): string {
  const name = pinAuthorLabel(item.account);
  return (name.replace(/^@/, '').trim().slice(0, 1) || 'M').toUpperCase();
}

/** Primary author label — username preferred (profile link target). */
function authorLabel(item: FeedItem): string {
  return pinAuthorLabel(item.account) || 'Minnesota Resident';
}

const CAPTION_PREVIEW_CHARS = 100;

function truncateCaption(text: string, max = CAPTION_PREVIEW_CHARS): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const breakAt = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\n'));
  const cut = breakAt > max * 0.6 ? breakAt : max;
  return text.slice(0, cut).trimEnd();
}

function isolateFromPost(e: MouseEvent) {
  e.stopPropagation();
}

/** Legacy name — stops post open; use on controls that must not bubble. */
function stopCardNav(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** Timeline row — no card chrome; parent provides divide-y. */
export function FeedPostCard({
  item,
  onRemoved,
  onPostUpdated,
}: {
  item: FeedItem;
  /** Called when the viewer archives/blocks so parents can drop the row. */
  onRemoved?: (postId: string) => void;
  /** Called after the owner saves a full edit. */
  onPostUpdated?: () => void;
}) {
  const router = useRouter();
  const { account } = useAuthSafe();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [liked, setLiked] = useState(Boolean(item.is_liked));
  const [likeCount, setLikeCount] = useState(item.like_count);
  const [likeBusy, setLikeBusy] = useState(false);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const impressionRef = useFeedPostImpression(item.id);
  const caption = (bodyOverride ?? item.body)?.trim() || 'Post';
  const captionNeedsTruncate = caption.length > CAPTION_PREVIEW_CHARS;
  const shownCaption =
    captionNeedsTruncate && !captionExpanded
      ? truncateCaption(caption)
      : caption;
  const placeLabel = item.place_label?.trim() || null;
  const hasPlaceLine = Boolean(placeLabel || item.city_name || item.zip_code);
  const hasMapFocus =
    typeof item.lat === 'number' &&
    typeof item.lng === 'number' &&
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lng);
  const name = authorLabel(item);
  const mediaUrl = item.media_url?.trim() || null;
  const href = postPath(item.id);
  const profileHref = feedAuthorProfilePath(item.account, item.account_id);

  const lightboxItems: PinPostMedia[] = mediaUrl
    ? [
        {
          id: `${item.id}-media`,
          url: mediaUrl,
          type: 'image',
          alt: null,
          sort_order: 0,
        },
      ]
    : [];

  const openLightbox = (e: MouseEvent) => {
    stopCardNav(e);
    setLightboxOpen(true);
  };

  const onLike = useCallback(
    async (e?: MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (!account || likeBusy) return;
      const next = !liked;
      setLiked(next);
      setLikeCount((c) => c + (next ? 1 : -1));
      setLikeBusy(true);
      try {
        const res = await togglePinPostLike(item.id, next);
        setLiked(res.reacted);
        setLikeCount(res.like_count);
      } catch {
        setLiked(!next);
        setLikeCount((c) => c + (next ? -1 : 1));
      } finally {
        setLikeBusy(false);
      }
    },
    [account, item.id, likeBusy, liked],
  );

  const onComment = useCallback(
    (e?: MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      setLightboxOpen(false);
      router.push(href);
    },
    [href, router],
  );

  const openPost = useCallback(
    (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('button, a')) return;
      router.push(href);
    },
    [href, router],
  );

  const openPostFromKeyboard = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      router.push(href);
    },
    [href, router],
  );

  const avatar = item.account?.image_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.account.image_url}
      alt=""
      className="h-full w-full object-cover"
    />
  ) : item.emoji?.trim() ? (
    <div className="flex h-full w-full items-center justify-center text-base">
      {item.emoji}
    </div>
  ) : (
    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-foreground">
      {authorInitials(item)}
    </div>
  );

  if (hidden) return null;

  return (
    <article
      ref={impressionRef}
      onClick={openPost}
      className="relative cursor-pointer transition-colors active:bg-black/[0.03]"
    >
      <div className="relative flex gap-2.5 px-4 py-2.5">
        {profileHref ? (
          <Link
            href={profileHref}
            aria-label={`Open profile ${name}`}
            onClick={isolateFromPost}
            className="relative z-[2] h-10 w-10 shrink-0 overflow-hidden rounded-full border border-black/10 bg-lake-blue/15 transition active:opacity-80"
          >
            {avatar}
          </Link>
        ) : (
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-black/10 bg-lake-blue/15">
            {avatar}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden pr-0.5">
              {profileHref ? (
                <Link
                  href={profileHref}
                  onClick={isolateFromPost}
                  className="relative z-[2] min-w-0 shrink truncate text-[15px] font-semibold leading-none tracking-tight text-foreground transition active:opacity-70"
                >
                  {name}
                </Link>
              ) : (
                <span className="min-w-0 shrink truncate text-[15px] font-semibold leading-none tracking-tight text-foreground">
                  {name}
                </span>
              )}
              <span
                className="shrink-0 text-[13px] leading-none text-foreground-muted"
                aria-hidden
              >
                ·
              </span>
              <time
                dateTime={item.created_at}
                className="shrink-0 text-[13px] leading-none tabular-nums text-foreground-muted"
              >
                {formatCompactTime(item.created_at)}
              </time>
            </div>
            <div onClick={isolateFromPost} onKeyDown={(e) => e.stopPropagation()}>
              <PostOverflowMenu
                compact
                postId={item.id}
                accountId={item.account_id}
                body={bodyOverride ?? item.body}
                stopCardNav={stopCardNav}
                onPostUpdated={() => {
                  onPostUpdated?.();
                  setBodyOverride(null);
                }}
                onArchived={() => {
                  setHidden(true);
                  onRemoved?.(item.id);
                }}
                onBlocked={() => {
                  setHidden(true);
                  onRemoved?.(item.id);
                }}
              />
            </div>
          </div>

          <p
            tabIndex={0}
            onKeyDown={openPostFromKeyboard}
            className="whitespace-pre-wrap text-[15px] leading-snug text-foreground"
          >
            {shownCaption}
            {captionNeedsTruncate && !captionExpanded ? '…' : null}
            {captionNeedsTruncate ? (
              <>
                {' '}
                <button
                  type="button"
                  onClick={(e) => {
                    isolateFromPost(e);
                    setCaptionExpanded((v) => !v);
                  }}
                  className="inline font-semibold text-foreground-muted transition active:opacity-70"
                >
                  {captionExpanded ? 'Show less' : 'Read more'}
                </button>
              </>
            ) : null}
          </p>

          {mediaUrl ? (
            <button
              type="button"
              aria-label="View photo"
              onClick={openLightbox}
              className="mt-2.5 block w-full overflow-hidden rounded-2xl bg-black/[0.04] transition active:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl}
                alt=""
                className="aspect-[16/10] w-full object-cover"
              />
            </button>
          ) : null}

          {hasPlaceLine || hasMapFocus ? (
            <PostPlaceLine
              cityName={item.city_name}
              zipCode={item.zip_code}
              unitId={item.unit_id}
              zipcodeId={item.zipcode_id}
              onLinkClick={isolateFromPost}
              linkClassName="transition active:opacity-70 hover:text-foreground"
              trailing={
                hasMapFocus ? (
                  <PostSeeOnMapPopover
                    lat={item.lat as number}
                    lng={item.lng as number}
                  />
                ) : null
              }
            />
          ) : null}

          <div className="mt-2.5 flex items-center gap-5 text-[13px] text-foreground-muted">
            <button
              type="button"
              onClick={(e) => void onLike(e)}
              disabled={likeBusy || !account}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike' : 'Like'}
              className={`inline-flex items-center gap-1.5 transition active:opacity-70 disabled:opacity-40 ${
                liked ? 'text-red-500' : ''
              }`}
            >
              <IconHeart className="h-4 w-4" solid={liked} />
              {likeCount}
            </button>
            <button
              type="button"
              onClick={onComment}
              aria-label="Comment"
              className="inline-flex items-center gap-1.5 transition active:opacity-70"
            >
              <IconChat className="h-4 w-4" />
              {item.comment_count}
            </button>
          </div>
        </div>
      </div>

      {lightboxOpen && lightboxItems.length > 0 ? (
        <PinMediaLightbox
          items={lightboxItems}
          index={0}
          onClose={() => setLightboxOpen(false)}
          author={{
            name,
            imageUrl: item.account?.image_url,
            fallback: item.emoji?.trim() || authorInitials(item),
          }}
          footer={
            <PostLightboxActions
              liked={liked}
              likeCount={likeCount}
              commentCount={item.comment_count}
              likeDisabled={likeBusy || !account}
              onLike={() => void onLike()}
              onComment={() => onComment()}
            />
          }
        />
      ) : null}
    </article>
  );
}
