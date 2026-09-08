import type { TextLayerData } from '@/components/media/capture/TextOverlay/types';

export type PinPostMedia = {
  id: string;
  url: string;
  type: string | null;
  alt: string | null;
  sort_order: number | null;
  /**
   * Video text overlays stored in post meta (CSS playback).
   * TODO(ffmpeg): replace with burned-in frames for export.
   */
  textLayers?: TextLayerData[] | null;
};

export type PinPostAuthor = {
  id: string;
  username: string | null;
  image_url: string | null;
  first_name: string | null;
  last_name: string | null;
};

export type PinPostDetail = {
  id: string;
  kind: string;
  /** `standard` | `story` */
  content_shape?: string | null;
  body: string | null;
  emoji: string | null;
  /** @deprecated Prefer place_* — street-level; do not show on feed/post chrome. */
  full_address: string | null;
  unit_id?: string | null;
  zipcode_id?: string | null;
  city_name?: string | null;
  zip_code?: string | null;
  place_label?: string | null;
  lat: number | null;
  lng: number | null;
  account_id: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  visibility?: string | null;
  mention_type_id?: string | null;
  mention_type: { id: string; name: string; emoji: string } | null;
  interest?: { id: string; slug: string; name: string } | null;
  archived?: boolean;
  expires_at?: string | null;
  account: PinPostAuthor | null;
  media: PinPostMedia[];
  is_liked: boolean;
  is_owner: boolean;
  /** True when the signed-in viewer already reported this post (no withdraw). */
  is_reported: boolean;
};

export type ActivityTab = 'pins' | 'likes' | 'comments' | 'archived';

export type ActivityItem = {
  id: string;
  kind: string;
  /** `standard` | `story` — Post vs Story badge in Pins / Archive. */
  content_shape: string | null;
  body: string | null;
  emoji: string | null;
  full_address: string | null;
  created_at: string;
  interaction_at: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  archived: boolean;
  expires_at?: string | null;
  comment_id?: string | null;
  comment_preview?: string | null;
  /** Post owner — Likes/Comments can surface someone else's post. */
  account_id: string | null;
  account: PinPostAuthor | null;
  /** First image on the post (own media, or the parent's). Videos are skipped. */
  media_url: string | null;
};

export async function fetchActivity(
  tab: ActivityTab,
  signal?: AbortSignal,
): Promise<ActivityItem[]> {
  const res = await fetch(
    `/api/community/activity?tab=${encodeURIComponent(tab)}`,
    { cache: 'no-store', credentials: 'include', signal },
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Failed to load activity');
  }
  const json = (await res.json()) as { items?: ActivityItem[] };
  return json.items ?? [];
}

export type PinPostComment = {
  id: string;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
  author: PinPostAuthor | null;
};

export async function fetchPinPostDetail(
  postId: string,
  signal?: AbortSignal,
): Promise<PinPostDetail> {
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Post not found' : 'Failed to load post');
  }
  const json = (await res.json()) as { post?: PinPostDetail; error?: string };
  if (!json.post) throw new Error(json.error ?? 'Failed to load post');
  return json.post;
}

export async function recordPinPostView(postId: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/view`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { view_count?: number | null };
    return typeof json.view_count === 'number' ? json.view_count : null;
  } catch {
    return null;
  }
}

export async function togglePinPostLike(
  postId: string,
  nextLiked: boolean,
): Promise<{ like_count: number; reacted: boolean }> {
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/react`, {
    method: nextLiked ? 'POST' : 'DELETE',
    headers: nextLiked ? { 'Content-Type': 'application/json' } : undefined,
    body: nextLiked ? JSON.stringify({ type: 'like' }) : undefined,
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Could not update like');
  return (await res.json()) as { like_count: number; reacted: boolean };
}

export async function fetchPinPostComments(
  postId: string,
  signal?: AbortSignal,
): Promise<PinPostComment[]> {
  const res = await fetch(
    `/api/community/posts/${encodeURIComponent(postId)}/comments?limit=30`,
    { cache: 'no-store', credentials: 'include', signal },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { comments?: PinPostComment[] };
  return json.comments ?? [];
}

export async function createPinPostComment(
  postId: string,
  body: string,
): Promise<{ comment: PinPostComment; comment_count: number | null }> {
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Could not comment');
  }
  return (await res.json()) as {
    comment: PinPostComment;
    comment_count: number | null;
  };
}

export async function updatePinPostCaption(
  postId: string,
  body: string,
  visibility?: string,
): Promise<{ body: string; visibility?: string }> {
  const payload: { body: string; visibility?: string } = { body };
  if (visibility) payload.visibility = visibility;
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Could not save');
  }
  const json = (await res.json().catch(() => ({}))) as {
    body?: string;
    visibility?: string;
  };
  return { body: json.body ?? body, visibility: json.visibility ?? visibility };
}

/** Owner-only — unarchive a pin (Your activity → Archive → Restore). */
export async function restorePinPost(
  postId: string,
): Promise<{ expires_at?: string | null }> {
  const res = await fetch(
    `/api/community/posts/${encodeURIComponent(postId)}/restore`,
    { method: 'POST', credentials: 'include' },
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Could not restore');
  }
  const json = (await res.json().catch(() => ({}))) as {
    expires_at?: string | null;
  };
  return { expires_at: json.expires_at ?? null };
}

export async function archivePinPost(postId: string): Promise<void> {
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Could not archive');
  }
}

/** Permanently delete an already-archived pin (owner only). */
export async function permanentlyDeletePinPost(postId: string): Promise<void> {
  const res = await fetch(
    `/api/community/posts/${encodeURIComponent(postId)}?permanent=1`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Could not delete');
  }
}

export type ReportPinPostReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'not_relevant'
  | 'other';

/** Submit a content report. Idempotent — cannot withdraw. */
export async function reportPinPost(
  postId: string,
  reason: ReportPinPostReason,
  details?: string,
): Promise<{ reported: true; already_reported: boolean }> {
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      reason,
      details: details?.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Could not report');
  }
  return (await res.json()) as { reported: true; already_reported: boolean };
}

export async function deleteOwnComment(commentId: string): Promise<void> {
  const res = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Could not remove comment');
  }
}

export function formatPinCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function pinAuthorLabel(author: PinPostAuthor | null | undefined): string {
  if (!author) return 'Community pin';
  if (author.username?.trim()) return `@${author.username.trim()}`;
  const name = [author.first_name, author.last_name].filter(Boolean).join(' ').trim();
  return name || 'Community pin';
}

/** Relative time — "Just now" / "20 mins ago" / "15 days ago". */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Math.max(0, Date.now() - then);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? '1 min ago' : `${min} mins ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return day === 1 ? '1 day ago' : `${day} days ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return month === 1 ? '1 month ago' : `${month} months ago`;
  const year = Math.floor(day / 365);
  return year <= 1 ? '1 year ago' : `${year} years ago`;
}

/** Short friendly clock for feed — `just now`, `5 min`, `1 hr ago`, `3 hrs`, `2 mos ago`. */
export function formatCompactTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? '1 hr ago' : `${hr} hrs`;
  const day = Math.floor(hr / 24);
  if (day < 30) return day === 1 ? '1 day ago' : `${day} days ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return month === 1 ? '1 mo ago' : `${month} mos ago`;
  const year = Math.floor(day / 365);
  return year === 1 ? '1 yr ago' : `${year} yrs ago`;
}
