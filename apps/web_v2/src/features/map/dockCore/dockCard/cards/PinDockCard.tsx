'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuthSafe } from '@/features/auth';
import { blockAccount } from '@/features/community/blockApi';
import {
  archivePinPost,
  createPinPostComment,
  fetchPinPostComments,
  fetchPinPostDetail,
  formatPinCount,
  formatRelativeTime,
  permanentlyDeletePinPost,
  pinAuthorLabel,
  recordPinPostView,
  restorePinPost,
  togglePinPostLike,
  updatePinPostCaption,
  type PinPostComment,
  type PinPostDetail,
} from '@/features/community/pinPostApi';
import {
  POST_CAPTION_MAX,
  POST_CAPTION_PREVIEW,
} from '@/features/community/postCaptionLimits';
import { PinPostMediaBlock } from '@/features/community/PinPostMediaBlock';
import { postTypeLabel } from '@/lib/community/storyExpiry';
import { refreshCommunityPins, markCommunityPinSeen } from '@/features/map/community';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  IconArrowLeft,
  IconChat,
  IconEllipsis,
  IconEye,
  IconFlag,
  IconHeart,
  IconPencil,
  IconRefresh,
  IconShield,
  IconTrash,
  IconX,
} from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { useMapTimeFilter } from '@/features/map/dockCore/hooks/useMapTimeFilter';

/** Handle + engagement footer + pads outside the measured body. */
const PIN_CARD_CHROME_PX = 148;

function authorHandle(author: PinPostDetail['account']): string {
  return pinAuthorLabel(author);
}

function CaptionBody({
  text,
  expanded,
  onToggle,
}: {
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const needsClamp = text.length > POST_CAPTION_PREVIEW;
  const shown =
    !needsClamp || expanded ? text : `${text.slice(0, POST_CAPTION_PREVIEW).trimEnd()}…`;

  return (
    <p className="whitespace-pre-wrap text-left text-[15px] leading-relaxed text-foreground/90">
      {shown}
      {needsClamp ? (
        <>
          {' '}
          <button
            type="button"
            onClick={onToggle}
            className="font-semibold text-lake-blue transition active:opacity-70"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        </>
      ) : null}
    </p>
  );
}

/** Community pin / post card — engagement + post options menu. */
export default function PinDockCard() {
  const {
    pinCardEntity,
    pinReturnToActivity,
    pinReturnToProfileId,
    closeDockCard,
    openDockCard,
    openProfileCard,
    openReportCard,
    openAccount,
    snap,
    setHalfContentPx,
  } = useMapDock();
  const { account } = useAuthSafe();
  const { value: timeFilter } = useMapTimeFilter();
  const entity = pinCardEntity;
  const measureRef = useRef<HTMLDivElement>(null);

  const [post, setPost] = useState<PinPostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PinPostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const backToActivity = () => openDockCard('activity-detail');
  const backToProfile = () => {
    if (!pinReturnToProfileId) return;
    openProfileCard(pinReturnToProfileId);
  };
  const returnFromPin = () => {
    if (pinReturnToProfileId) backToProfile();
    else if (pinReturnToActivity) backToActivity();
    else closeDockCard();
  };

  const mediaCount = post?.media?.length ?? 0;

  // Short text-only pins: shrink half detent to content instead of empty glass.
  useLayoutEffect(() => {
    if (!entity || !post || commentsOpen || editing || mediaCount > 0 || snap === 'full') {
      setHalfContentPx(null);
      return;
    }
    const el = measureRef.current;
    if (!el) return;

    const measure = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setHalfContentPx(h + PIN_CARD_CHROME_PX);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setHalfContentPx(null);
    };
  }, [
    entity,
    post,
    commentsOpen,
    editing,
    mediaCount,
    snap,
    captionExpanded,
    menuOpen,
    post?.body,
    setHalfContentPx,
  ]);

  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!entity?.id) {
      setPost(null);
      return;
    }
    const ac = new AbortController();
    // Drop prior post so another pin's media never flashes before this payload resolves.
    setPost(null);
    setLoading(true);
    setError(null);
    setCommentsOpen(false);
    setMenuOpen(false);
    setEditing(false);
    setConfirmDelete(false);
    setConfirmBlock(false);
    setBlockError(null);
    setCaptionExpanded(false);
    void fetchPinPostDetail(entity.id, ac.signal)
      .then((detail) => {
        setPost(detail);
        setLiked(detail.is_liked);
        setLikeCount(detail.like_count);
        setCommentCount(detail.comment_count);
        setViewCount(detail.view_count);
        setEditBody(detail.body ?? '');
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setPost(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [entity?.id]);

  useEffect(() => {
    if (!post?.id) return;
    if (viewedRef.current === post.id) return;
    viewedRef.current = post.id;
    markCommunityPinSeen(post.id);
    void recordPinPostView(post.id).then((n) => {
      if (typeof n === 'number') setViewCount(n);
      else setViewCount((c) => c + 1);
    });
  }, [post?.id]);

  const isOwner =
    post?.is_owner === true ||
    Boolean(account?.id && post?.account_id && account.id === post.account_id);

  const onLike = async () => {
    if (!post || likeBusy) return;
    if (!account) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    setLikeBusy(true);
    try {
      const res = await togglePinPostLike(post.id, next);
      setLiked(res.reacted);
      setLikeCount(res.like_count);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    } finally {
      setLikeBusy(false);
    }
  };

  const loadComments = async () => {
    if (!post) return;
    setCommentsLoading(true);
    try {
      const rows = await fetchPinPostComments(post.id);
      setComments(rows);
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleComments = () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next) void loadComments();
  };

  const onComment = async () => {
    if (!post || !account || commentBusy) return;
    const text = draft.trim();
    if (!text) return;
    setCommentBusy(true);
    try {
      const res = await createPinPostComment(post.id, text);
      setDraft('');
      setComments((prev) => [res.comment, ...prev]);
      if (typeof res.comment_count === 'number') setCommentCount(res.comment_count);
      else setCommentCount((c) => c + 1);
    } catch {
      /* keep draft */
    } finally {
      setCommentBusy(false);
    }
  };

  const onSaveEdit = async () => {
    if (!post || editBusy) return;
    const text = editBody.trim();
    if (!text) return;
    setEditBusy(true);
    try {
      await updatePinPostCaption(post.id, text);
      setPost((p) => (p ? { ...p, body: text } : p));
      setEditing(false);
      setMenuOpen(false);
      setCaptionExpanded(false);
      void refreshCommunityPins(timeFilter);
    } catch {
      /* stay in edit */
    } finally {
      setEditBusy(false);
    }
  };

  const onArchive = async () => {
    if (!post || archiveBusy) return;
    setArchiveBusy(true);
    try {
      await archivePinPost(post.id);
      setMenuOpen(false);
      if (pinReturnToProfileId || pinReturnToActivity) returnFromPin();
      else closeDockCard();
      void refreshCommunityPins(timeFilter);
    } catch {
      setArchiveBusy(false);
    }
  };

  const onPermanentDelete = async () => {
    if (!post || deleteBusy || !post.archived) return;
    setDeleteBusy(true);
    try {
      await permanentlyDeletePinPost(post.id);
      setMenuOpen(false);
      setConfirmDelete(false);
      if (pinReturnToProfileId || pinReturnToActivity) returnFromPin();
      else closeDockCard();
      void refreshCommunityPins(timeFilter);
    } catch {
      setDeleteBusy(false);
    }
  };

  const onRestore = async () => {
    if (!post || restoreBusy || !post.archived) return;
    setRestoreBusy(true);
    try {
      const restored = await restorePinPost(post.id);
      setPost((p) =>
        p
          ? {
              ...p,
              archived: false,
              expires_at:
                restored.expires_at !== undefined
                  ? restored.expires_at
                  : p.expires_at,
            }
          : p,
      );
      setMenuOpen(false);
      void refreshCommunityPins(timeFilter);
    } catch {
      /* keep menu open so the owner can retry */
    } finally {
      setRestoreBusy(false);
    }
  };

  if (!entity) {
    return (
      <DockCardShell variant="pin" titleMode="center" title="Post">
        <p className="text-center text-sm text-foreground-muted">
          This post is no longer available.
        </p>
      </DockCardShell>
    );
  }

  const title = post ? authorHandle(post.account) : entity.title;
  /** Only clickable once the post payload resolves a real account — never during load. */
  const authorId = post?.account?.id ?? post?.account_id ?? null;
  const body = editing ? editBody : post?.body ?? entity.summary;
  const imageUrl = post?.account?.image_url ?? entity.imageUrl;
  const media = post?.media ?? [];
  const archived = Boolean(post?.archived);
  const typeLabel = post ? postTypeLabel(post.content_shape) : null;
  const postedAt = post?.created_at ? formatRelativeTime(post.created_at) : null;
  const showActionPill = Boolean(post) && !editing;

  const avatar = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      className="h-11 w-11 shrink-0 rounded-full object-cover"
    />
  ) : (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lake-blue text-white"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 19.5c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" />
      </svg>
    </div>
  );

  const menuButton = (
    <button
      type="button"
      onClick={() => {
        setMenuOpen((o) => !o);
        setConfirmDelete(false);
      }}
      aria-label="Post options"
      aria-expanded={menuOpen}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-map-glass-chip text-foreground-muted transition active:scale-95"
    >
      <IconEllipsis className="h-5 w-5" />
    </button>
  );

  const closeMenu = () => {
    setMenuOpen(false);
    setConfirmDelete(false);
    setConfirmBlock(false);
    setBlockError(null);
  };

  const onBlockAuthor = async () => {
    const authorId = post?.account_id;
    if (!authorId || blockBusy) return;
    if (!account) {
      openAccount();
      return;
    }
    setBlockBusy(true);
    setBlockError(null);
    try {
      await blockAccount(authorId);
      closeMenu();
      closeDockCard();
      void refreshCommunityPins(timeFilter);
    } catch (e) {
      setBlockError(e instanceof Error ? e.message : 'Could not block user');
    } finally {
      setBlockBusy(false);
    }
  };

  const engagementFooter = showActionPill ? (
    <div className="flex justify-center">
      <div
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.12)] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        role="toolbar"
        aria-label="Post actions"
      >
        <button
          type="button"
          onClick={() => void onLike()}
          disabled={likeBusy || !account || archived}
          title={archived ? 'Archived pins can’t be liked' : undefined}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 transition active:scale-95 disabled:opacity-40 ${
            liked ? 'text-red-500' : 'text-foreground-muted'
          }`}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <IconHeart className="h-5 w-5" solid={liked} />
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {formatPinCount(likeCount)}
          </span>
        </button>
        <button
          type="button"
          onClick={toggleComments}
          disabled={archived && !commentsOpen}
          title={archived ? 'Archived pins are closed to new comments' : undefined}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 transition active:scale-95 disabled:opacity-40 ${
            commentsOpen ? 'text-lake-blue' : 'text-foreground-muted'
          }`}
          aria-expanded={commentsOpen}
          aria-label={commentsOpen ? 'Close comments' : 'Comments'}
        >
          <IconChat className="h-5 w-5" />
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {formatPinCount(commentCount)}
          </span>
        </button>
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-foreground-muted">
          <IconEye className="h-5 w-5" />
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {formatPinCount(viewCount)}
          </span>
        </div>
        {commentsOpen ? (
          <button
            type="button"
            onClick={() => setCommentsOpen(false)}
            aria-label="Close comments"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted transition active:scale-95"
          >
            <IconX className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <DockCardShell variant="pin" scrollKey={entity.id} footer={engagementFooter}>
      <div ref={measureRef} data-pin-dock-card="">
          {/* Back chrome — only when returning from Activity/Profile. */}
          {pinReturnToActivity || pinReturnToProfileId ? (
            <div className="flex items-center px-0.5 pb-1 pt-1">
              {pinReturnToProfileId ? (
                <button
                  type="button"
                  onClick={backToProfile}
                  className="inline-flex items-center gap-1 rounded-full py-1.5 pr-2 text-[13px] font-semibold text-foreground-muted transition active:opacity-70"
                  aria-label="Back to profile"
                >
                  <IconArrowLeft className="h-4 w-4" />
                  Profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={backToActivity}
                  className="inline-flex items-center gap-1 rounded-full py-1.5 pr-2 text-[13px] font-semibold text-foreground-muted transition active:opacity-70"
                  aria-label="Back to Activity"
                >
                  <IconArrowLeft className="h-4 w-4" />
                  Activity
                </button>
              )}
            </div>
          ) : null}

          {/* Header — avatar + username/timestamp left, ⋯ trailing on all posts. */}
          <div className="flex items-center gap-2.5 text-left">
            {authorId ? (
              <button
                type="button"
                onClick={() => openProfileCard(authorId)}
                aria-label={`View ${title}'s profile`}
                className="shrink-0 rounded-full bg-transparent p-0 active:opacity-80"
              >
                {avatar}
              </button>
            ) : (
              <div
                className={
                  loading && !post
                    ? 'shrink-0 animate-pulse rounded-full'
                    : 'shrink-0'
                }
              >
                {avatar}
              </div>
            )}

            <div className="min-w-0 flex-1 leading-none">
              {authorId ? (
                <button
                  type="button"
                  onClick={() => openProfileCard(authorId)}
                  className="block w-full max-w-full truncate bg-transparent p-0 text-left text-[1.05rem] font-semibold leading-none tracking-tight text-foreground active:opacity-70"
                >
                  {title}
                </button>
              ) : (
                <h2
                  className={`truncate text-[1.05rem] font-semibold leading-none tracking-tight text-foreground${
                    loading && !post ? ' animate-pulse' : ''
                  }`}
                >
                  {title}
                </h2>
              )}
              {postedAt || archived || typeLabel ? (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] leading-none text-foreground-muted">
                  {typeLabel ? (
                    <span
                      className={
                        post?.content_shape === 'story'
                          ? 'inline-flex items-center rounded-full bg-lake-blue/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lake-blue'
                          : 'inline-flex items-center rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted'
                      }
                    >
                      {typeLabel}
                    </span>
                  ) : null}
                  {postedAt ? <span>{postedAt}</span> : null}
                  {archived ? (
                    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Archived
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>

            {menuButton}
          </div>

          {menuOpen ? (
            <div
              className={`mt-2 mb-2 overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
              role="menu"
            >
              {isOwner ? (
                confirmDelete ? (
                  <div className="px-4 py-4">
                    <p className="text-[14px] font-semibold text-foreground">
                      Delete this pin permanently?
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-foreground-muted">
                      This can&rsquo;t be undone. The pin, its media, and comments will be removed.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={deleteBusy}
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded-xl bg-black/[0.04] py-2.5 text-[14px] font-medium text-foreground-muted disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deleteBusy}
                        onClick={() => void onPermanentDelete()}
                        className="flex-1 rounded-xl bg-red-600 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
                      >
                        {deleteBusy ? 'Deleting…' : 'Delete permanently'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-foreground transition active:bg-black/[0.04]"
                      onClick={() => {
                        setEditing(true);
                        setEditBody(post?.body ?? '');
                        setMenuOpen(false);
                        setCommentsOpen(false);
                      }}
                    >
                      <IconPencil className="h-5 w-5 text-foreground-muted" />
                      Edit caption
                    </button>
                    {archived ? (
                      <>
                        <div className="mx-3 h-px bg-black/[0.06]" />
                        <button
                          type="button"
                          role="menuitem"
                          disabled={restoreBusy}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-foreground transition active:bg-black/[0.04] disabled:opacity-50"
                          onClick={() => void onRestore()}
                        >
                          <IconRefresh className="h-5 w-5 text-foreground-muted" />
                          {restoreBusy ? 'Restoring…' : 'Restore from archive'}
                        </button>
                        <div className="mx-3 h-px bg-black/[0.06]" />
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-red-600 transition active:bg-black/[0.04]"
                          onClick={() => setConfirmDelete(true)}
                        >
                          <IconTrash className="h-5 w-5" />
                          Delete permanently
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="mx-3 h-px bg-black/[0.06]" />
                        <button
                          type="button"
                          role="menuitem"
                          disabled={archiveBusy}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-red-600 transition active:bg-black/[0.04] disabled:opacity-50"
                          onClick={() => void onArchive()}
                        >
                          <IconTrash className="h-5 w-5" />
                          {archiveBusy ? 'Archiving…' : 'Archive'}
                        </button>
                      </>
                    )}
                    <div className="mx-3 h-px bg-black/[0.06]" />
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[14px] font-medium text-foreground-muted"
                      onClick={closeMenu}
                    >
                      <IconX className="h-4 w-4" />
                      Cancel
                    </button>
                  </>
                )
              ) : confirmBlock ? (
                <>
                  <p className="px-4 py-3 text-[13px] leading-snug text-foreground-muted">
                    Hide this person&apos;s pins from your map. You can unblock later from
                    their profile.
                  </p>
                  {blockError ? (
                    <p className="px-4 pb-2 text-[12px] text-red-600">{blockError}</p>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={blockBusy || !post?.account_id}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-red-600 transition active:bg-black/[0.04] disabled:opacity-50"
                    onClick={() => void onBlockAuthor()}
                  >
                    <IconShield className="h-5 w-5" />
                    {blockBusy ? 'Blocking…' : 'Block user'}
                  </button>
                  <div className="mx-3 h-px bg-black/[0.06]" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[14px] font-medium text-foreground-muted"
                    onClick={() => {
                      setConfirmBlock(false);
                      setBlockError(null);
                    }}
                  >
                    <IconX className="h-4 w-4" />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {post?.is_reported ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled
                      aria-disabled="true"
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-foreground-muted opacity-70"
                    >
                      <IconFlag className="h-5 w-5" />
                      Reported
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-foreground transition active:bg-black/[0.04]"
                      onClick={() => {
                        setMenuOpen(false);
                        if (!account) {
                          openAccount();
                          return;
                        }
                        openReportCard();
                      }}
                    >
                      <IconFlag className="h-5 w-5 text-foreground-muted" />
                      Report
                    </button>
                  )}
                  {post?.account_id ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-red-600 transition active:bg-black/[0.04]"
                      onClick={() => {
                        if (!account) {
                          setMenuOpen(false);
                          openAccount();
                          return;
                        }
                        setConfirmBlock(true);
                      }}
                    >
                      <IconShield className="h-5 w-5" />
                      Block user
                    </button>
                  ) : null}
                  <div className="mx-3 h-px bg-black/[0.06]" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[14px] font-medium text-foreground-muted"
                    onClick={closeMenu}
                  >
                    <IconX className="h-4 w-4" />
                    Cancel
                  </button>
                </>
              )}
            </div>
          ) : null}

          {error && !post ? (
            <div
              className={`mt-1 rounded-2xl px-4 py-5 text-center ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
            >
              <p className="text-[13px] text-foreground-muted">{error}</p>
            </div>
          ) : null}

          {!commentsOpen && editing ? (
            <div
              className={`mt-2 rounded-2xl px-3 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
            >
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value.slice(0, POST_CAPTION_MAX))}
                rows={4}
                maxLength={POST_CAPTION_MAX}
                className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-foreground-muted"
                placeholder="Edit caption"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={editBusy}
                  onClick={() => {
                    setEditing(false);
                    setEditBody(post?.body ?? '');
                  }}
                  className="flex-1 rounded-xl py-2.5 text-[14px] font-medium text-foreground-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editBusy || !editBody.trim()}
                  onClick={() => void onSaveEdit()}
                  className="flex-1 rounded-xl bg-lake-blue py-2.5 text-[14px] font-semibold text-white disabled:opacity-45"
                >
                  {editBusy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : null}

          {/* Caption above media — plain text, no glass card chrome. */}
          {!commentsOpen && !editing && body ? (
            <div className="mt-1 px-0.5">
              <CaptionBody
                text={body}
                expanded={captionExpanded}
                onToggle={() => setCaptionExpanded((v) => !v)}
              />
            </div>
          ) : null}

          {!commentsOpen && post && media.length > 0 ? (
            <PinPostMediaBlock media={media} compact={snap !== 'full'} />
          ) : null}

          {commentsOpen && post ? (
            <div className="mt-2 flex flex-col">
              {archived ? (
                <p className="px-1 text-[13px] text-foreground-muted">
                  This pin is archived — new comments are closed.
                </p>
              ) : account ? (
                <div className="flex gap-2 px-0.5">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={2000}
                    placeholder="Add a comment"
                    autoFocus
                    className="min-w-0 flex-1 rounded-xl bg-black/[0.04] px-3 py-2.5 text-[14px] text-foreground outline-none placeholder:text-foreground-muted"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void onComment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={commentBusy || !draft.trim()}
                    onClick={() => void onComment()}
                    className="shrink-0 rounded-xl bg-lake-blue px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-45"
                  >
                    Post
                  </button>
                </div>
              ) : (
                <p className="px-1 text-[13px] text-foreground-muted">Sign in to comment.</p>
              )}

              <div className="mt-3 space-y-3.5 px-0.5 pb-1">
                {commentsLoading ? (
                  <p className="text-[13px] text-foreground-muted">Loading comments…</p>
                ) : comments.length === 0 ? (
                  <p className="text-[13px] text-foreground-muted">No comments yet.</p>
                ) : (
                  comments.map((c) => {
                    const commentAuthorId = c.author?.id ?? null;
                    const commentAvatar = c.author?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.author.image_url}
                        alt=""
                        className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lake-blue/20 text-[10px] font-bold text-lake-blue">
                        {(c.author?.username ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                    );
                    return (
                      <div key={c.id} className="flex gap-2.5">
                        {commentAuthorId ? (
                          <button
                            type="button"
                            onClick={() => openProfileCard(commentAuthorId)}
                            aria-label={`View ${pinAuthorLabel(c.author)}'s profile`}
                            className="shrink-0 rounded-full active:opacity-80"
                          >
                            {commentAvatar}
                          </button>
                        ) : (
                          commentAvatar
                        )}
                        <div className="min-w-0">
                          <p className="flex items-baseline gap-1.5 text-[12px] font-semibold text-foreground">
                            {commentAuthorId ? (
                              <button
                                type="button"
                                onClick={() => openProfileCard(commentAuthorId)}
                                className="truncate active:opacity-70"
                              >
                                {pinAuthorLabel(c.author)}
                              </button>
                            ) : (
                              pinAuthorLabel(c.author)
                            )}
                            <span className="font-normal text-foreground-muted">
                              {formatRelativeTime(c.created_at)}
                            </span>
                          </p>
                          <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground/90">
                            {c.body}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
      </div>
    </DockCardShell>
  );
}
