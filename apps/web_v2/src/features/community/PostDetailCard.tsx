'use client';

/**
 * PostDetailCard — shown when a player taps a community-* world placement.
 *
 * Fetches the parent post from GET /api/community/posts/[id] and renders
 * a compact bottom-anchored card with author, category badge, body, media
 * thumbnail strip, and engagement counts.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import {
  closePostDetailCard,
  getPostDetailCardState,
  subscribePostDetailCard,
} from '@/features/community/postDetailCardStore';

// ── Types ──────────────────────────────────────────────────────────────────

type PostAccount = {
  id: string;
  username: string | null;
  image_url: string | null;
  first_name: string | null;
  last_name: string | null;
} | null;

type PostMedia = {
  id: string;
  url: string;
  type: string;
  sort_order: number;
};

type MentionType = {
  id: string;
  name: string;
  emoji: string;
} | null;

type PostDetail = {
  id: string;
  body: string | null;
  full_address: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  mention_type: MentionType;
  account: PostAccount;
  media: PostMedia[];
  is_liked: boolean;
  is_owner: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function displayName(account: PostAccount): string {
  if (!account) return 'Minnesota Resident';
  if (account.username) return `@${account.username}`;
  const full = [account.first_name, account.last_name].filter(Boolean).join(' ');
  return full || 'Minnesota Resident';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Fetch ──────────────────────────────────────────────────────────────────

async function fetchPost(postId: string): Promise<PostDetail | null> {
  try {
    const res = await fetch(`/api/community/posts/${postId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { post?: PostDetail };
    return json.post ?? null;
  } catch {
    return null;
  }
}

// ── Card ───────────────────────────────────────────────────────────────────

function PostCard({ postId }: { postId: string }) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPost(null);
    fetchPost(postId).then((p) => {
      setPost(p);
      setLoading(false);
    });
  }, [postId]);

  const category = post?.mention_type;
  const author = post?.account ?? null;
  const firstImage = post?.media.find((m) => m.type === 'image');

  return (
    <div className="relative bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-sm mx-auto shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {category && (
            <span className="text-base">{category.emoji}</span>
          )}
          <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
            {category?.name ?? 'Community'}
          </span>
        </div>
        <button
          onClick={closePostDetailCard}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loading && (
        <div className="px-4 pb-5 pt-2">
          <div className="h-3 w-3/4 bg-white/10 rounded animate-pulse mb-2" />
          <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
        </div>
      )}

      {!loading && !post && (
        <div className="px-4 pb-5 pt-2 text-sm text-white/40">
          Post not found.
        </div>
      )}

      {!loading && post && (
        <>
          {/* Optional thumbnail */}
          {firstImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firstImage.url}
              alt=""
              className="w-full h-36 object-cover"
            />
          )}

          <div className="px-4 pt-3 pb-4 space-y-3">
            {/* Body */}
            {post.body ? (
              <p className="text-sm text-white leading-relaxed line-clamp-4">
                {post.body}
              </p>
            ) : null}

            {/* Address */}
            {post.full_address ? (
              <p className="text-xs text-white/40 truncate">{post.full_address}</p>
            ) : null}

            {/* Footer row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {/* Avatar placeholder */}
                <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                  {author?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={author.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="text-xs text-white/50 truncate max-w-[120px]">
                  {displayName(author)}
                </span>
              </div>

              <div className="flex items-center gap-3 text-white/40 text-xs">
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  {post.like_count}
                </span>
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {post.comment_count}
                </span>
                <span>{timeAgo(post.created_at)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Modal wrapper ──────────────────────────────────────────────────────────

export function PostDetailCard() {
  const cardState = useSyncExternalStore(
    subscribePostDetailCard,
    getPostDetailCardState,
    () => null,
  );

  if (!cardState) return null;

  return (
    <DialogBackdrop onClose={closePostDetailCard} align="end" layer="CRITICAL_DIALOG">
      <PostCard postId={cardState.postId} />
    </DialogBackdrop>
  );
}
