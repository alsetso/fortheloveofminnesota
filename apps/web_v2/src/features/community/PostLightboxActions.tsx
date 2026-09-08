'use client';

import { formatPinCount } from '@/features/community/pinPostApi';
import { IconChat, IconHeart } from '@/features/map/dockCore/core/icons';

/** Like + comment bar for the fullscreen media lightbox (dark chrome). */
export function PostLightboxActions({
  liked,
  likeCount,
  commentCount,
  likeDisabled,
  onLike,
  onComment,
}: {
  liked: boolean;
  likeCount: number;
  commentCount: number;
  likeDisabled?: boolean;
  onLike?: () => void;
  onComment?: () => void;
}) {
  return (
    <div className="flex items-center gap-6 px-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onLike?.();
        }}
        disabled={likeDisabled || !onLike}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike' : 'Like'}
        className={`inline-flex items-center gap-2 text-[15px] font-semibold transition active:scale-95 disabled:opacity-40 ${
          liked ? 'text-red-400' : 'text-white'
        }`}
      >
        <IconHeart className="h-6 w-6" solid={liked} />
        {formatPinCount(likeCount)}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onComment?.();
        }}
        disabled={!onComment}
        aria-label="Comment"
        className="inline-flex items-center gap-2 text-[15px] font-semibold text-white transition active:scale-95 disabled:opacity-40"
      >
        <IconChat className="h-6 w-6" />
        {formatPinCount(commentCount)}
      </button>
    </div>
  );
}
